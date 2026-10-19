/* Browser-local case records. Keep input separate from calculated output so charts can be rebuilt after rule updates. */
window.CaseStore = (() => {
  const DB_NAME = 'bazi-local-cases';
  const DB_VERSION = 1;
  let connection;

  function open() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('此浏览器暂不支持本地案例保存'));
    if (!connection) connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cases')) {
          const cases = db.createObjectStore('cases', { keyPath: 'id' });
          cases.createIndex('updatedAt', 'updatedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法打开本地案例'));
    }).catch(error => { connection = null; throw error; });
    return connection;
  }

  async function transaction(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', mode);
      const request = operation(tx.objectStore('cases'));
      tx.oncomplete = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('案例保存失败'));
      tx.onerror = () => reject(tx.error || new Error('案例保存失败'));
    });
  }

  const list = async () => (await transaction('readonly', store => store.getAll()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const get = id => transaction('readonly', store => store.get(id));
  const put = record => transaction('readwrite', store => store.put(record));
  async function putMany(records) {
    if (!records.length) return 0;
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cases', 'readwrite');
      const store = tx.objectStore('cases');
      for (const record of records) store.put(record);
      tx.oncomplete = () => resolve(records.length);
      tx.onerror = () => reject(tx.error || new Error('批量保存失败'));
      tx.onabort = () => reject(tx.error || new Error('批量保存失败'));
    });
  }
  return { list, get, put, putMany };
})();
