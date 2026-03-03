 // Firebase SDK must be loaded before this file

const firebaseConfig = {
  apiKey: "AIzaSyDIFLO7rwIJbJnAt2EV7m57ydkPfH9FQzA",
  authDomain: "campus-prime.firebaseapp.com",
  projectId: "campus-prime",
  storageBucket: "campus-prime.firebasestorage.app",
  messagingSenderId: "934780803109",
  appId: "1:934780803109:web:678a903369166ce72f07cc"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();
