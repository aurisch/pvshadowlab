const DATABASE_NAME = 'pv-shadowlab'
const STORE_NAME = 'local-assets'
const PHOTO_KEY = 'reference-photo'

export interface StoredPhoto {
  blob: Blob
  name: string
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Lokaler Bildspeicher konnte nicht geöffnet werden.'))
  })
}

export async function saveLastPhoto(photo: StoredPhoto): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(photo, PHOTO_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Foto konnte nicht lokal gespeichert werden.'))
  })
  database.close()
}

export async function loadLastPhoto(): Promise<StoredPhoto | null> {
  const database = await openDatabase()
  const result = await new Promise<StoredPhoto | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(PHOTO_KEY)
    request.onsuccess = () => resolve(request.result as StoredPhoto | undefined)
    request.onerror = () => reject(request.error ?? new Error('Foto konnte nicht lokal geladen werden.'))
  })
  database.close()
  return result ?? null
}
