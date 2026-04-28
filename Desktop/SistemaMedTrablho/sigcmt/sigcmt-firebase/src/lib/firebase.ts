import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyBVEZmFb-KBHFCMYTVGwrZNsqQhr7BoPvk',
  authDomain: 'sistemamedtrablho.firebaseapp.com',
  projectId: 'sistemamedtrablho',
  storageBucket: 'sistemamedtrablho.firebasestorage.app',
  messagingSenderId: '626954079734',
  appId: '1:626954079734:web:1fe8826017554f38484bd7',
}

export const app  = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)
export const storage = getStorage(app)
