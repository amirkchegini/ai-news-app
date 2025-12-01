// Service Worker for AI News PWA
const CACHE_NAME = 'ai-news-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.css',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.js'
];

// Install Event - Cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients
      return self.clients.claim();
    })
  );
});

// Fetch Event - Serve cached content when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response for caching
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Return offline page for navigation requests
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Background Sync for news updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-news-sync') {
    console.log('Background sync for news updates');
    event.waitUntil(
      // In a real app, this would fetch new news from APIs
      // and update the cache
      updateNewsInBackground()
    );
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'اخبار جدید هوش مصنوعی موجود است!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'مشاهده خبرها',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'بستن',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('🤖 AI News', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received');
  
  event.notification.close();

  if (event.action === 'explore') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification (already done above)
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background news update function
async function updateNewsInBackground() {
  try {
    // In a real app, this would fetch from actual news APIs
    console.log('Updating news in background...');
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // This would typically update cached news data
    // For now, we'll just log that it happened
    console.log('News update completed');
    
    return true;
  } catch (error) {
    console.error('Background news update failed:', error);
    return false;
  }
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  if (event.data && event.data.type === 'CACHE_NEWS') {
    // Cache news data for offline use
    const newsData = event.data.payload;
    caches.open(CACHE_NAME).then(cache => {
      const response = new Response(JSON.stringify(newsData), {
        headers: { 'Content-Type': 'application/json' }
      });
      cache.put('/cached-news', response);
    });
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'news-periodic-sync') {
    console.log('Periodic news sync triggered');
    event.waitUntil(updateNewsInBackground());
  }
});

console.log('Service Worker loaded successfully');