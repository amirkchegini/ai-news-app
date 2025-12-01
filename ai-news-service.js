// AI News API Service
class AINewsService {
    constructor() {
        this.apiKeys = {
            // Free tier API keys - replace with your own for production
            newsapi: 'YOUR_NEWSAPI_KEY',
            gnews: 'YOUR_GNEWS_API_KEY',
            translate: 'YOUR_TRANSLATE_API_KEY' // برای ترجمه
        };
        this.cachedNews = null;
        this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
        this.translationCache = new Map(); // Cache ترجمه‌ها
        
        // خبرگزاری‌های معتبر تکنولوژی - RSS و API های رایگان
        this.techNewsSources = [
            {
                name: 'TechCrunch',
                rssUrl: 'https://techcrunch.com/category/artificial-intelligence/feed/',
                type: 'rss'
            },
            {
                name: 'MIT Technology Review',
                rssUrl: 'https://www.technologyreview.com/feed/',
                type: 'rss'
            },
            {
                name: 'The Verge AI',
                rssUrl: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
                type: 'rss'
            },
            {
                name: 'VentureBeat AI',
                rssUrl: 'https://venturebeat.com/ai/feed/',
                type: 'rss'
            },
            {
                name: 'Ars Technica',
                rssUrl: 'https://feeds.arstechnica.com/arstechnica/index',
                type: 'rss'
            },
            {
                name: 'Wired AI',
                rssUrl: 'https://www.wired.com/feed/category/business/ai/artificial-intelligence/rss',
                type: 'rss'
            },
            {
                name: 'IEEE Spectrum',
                rssUrl: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence',
                type: 'rss'
            }
        ];
        
        // Hacker News API (JSON - بدون نیاز به API key)
        this.hackerNewsUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    }
    
    // Fetch news from multiple sources
    async fetchAINews() {
        try {
            // Try to fetch from real APIs first
            const apiPromises = [];
            
            // Add NewsAPI if key exists
            if (this.apiKeys.newsapi && this.apiKeys.newsapi !== 'YOUR_NEWSAPI_KEY') {
                apiPromises.push(this.fetchFromNewsAPI());
            }
            
            // Add GNews if key exists
            if (this.apiKeys.gnews && this.apiKeys.gnews !== 'YOUR_GNEWS_API_KEY') {
                apiPromises.push(this.fetchFromGNews());
            }
            
            // Always add RSS feeds (they don't need keys)
            apiPromises.push(this.fetchFromRSSFeeds());
            
            // Add Hacker News
            apiPromises.push(this.fetchFromHackerNews());
            
            const results = await Promise.allSettled(apiPromises);
            
            let combinedNews = [];
            
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    combinedNews = combinedNews.concat(result.value);
                }
            }
            
            // If we got real news, use them; otherwise use fallback
            if (combinedNews.length > 0) {
                this.cachedNews = {
                    data: combinedNews,
                    timestamp: Date.now()
                };
                return this.processNewsData(combinedNews);
            } else {
                throw new Error('No news from any source');
            }
            
        } catch (error) {
            console.log('All API fetch failed, using cached/fallback news:', error);
            return this.getFallbackNews();
        }
    }
    
    // Fetch from NewsAPI.org (with fallback protection)
    async fetchFromNewsAPI() {
        // Skip if no valid API key
        if (!this.apiKeys.newsapi || this.apiKeys.newsapi === 'YOUR_NEWSAPI_KEY') {
            throw new Error('NewsAPI key not available');
        }
        
        const query = 'artificial intelligence OR AI OR "machine learning" OR "deep learning" OR ChatGPT OR OpenAI OR Gemini OR Claude OR DeepSeek OR Manus OR Kimi OR "AI model" OR "generative AI" OR "AI tool" OR "AI platform" OR Midjourney OR "Stable Diffusion" OR "neural network" OR "computer vision" OR "natural language processing"';
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=30&apiKey=${this.apiKeys.newsapi}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('NewsAPI request failed');
        
        const data = await response.json();
        
        return (data.articles || []).map((article, index) => ({
            id: `newsapi-${index}`,
            title: article.title || '',
            summary: article.description || article.content || '',
            source: article.source?.name || 'News API',
            url: article.url || '',
            category: this.categorizeNews(article.title + ' ' + (article.description || '')),
            date: article.publishedAt ? new Date(article.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            publishedAt: article.publishedAt || new Date().toISOString(),
            imageUrl: article.urlToImage
        })).filter(article => article.title && article.summary && article.title.length > 10);
    }
    
    // Fetch from GNews API (with fallback protection)
    async fetchFromGNews() {
        // Skip if no valid API key
        if (!this.apiKeys.gnews || this.apiKeys.gnews === 'YOUR_GNEWS_API_KEY') {
            throw new Error('GNews key not available');
        }
        
        const query = 'artificial intelligence OR AI OR machine learning OR ChatGPT OR OpenAI OR Gemini OR Claude OR DeepSeek OR Manus OR Kimi OR "AI model" OR "generative AI" OR "AI tool" OR "AI platform" OR Midjourney OR "Stable Diffusion" OR "AI assistant" OR "neural network" OR "computer vision"';
        const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&country=us&max=30&apikey=${this.apiKeys.gnews}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('GNews request failed');
        
        const data = await response.json();
        
        return (data.articles || []).map((article, index) => ({
            id: `gnews-${index}`,
            title: article.title || '',
            summary: article.description || '',
            source: 'GNews',
            url: article.url || '',
            category: this.categorizeNews(article.title + ' ' + (article.description || '')),
            date: article.publishedAt ? new Date(article.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            publishedAt: article.publishedAt || new Date().toISOString(),
            imageUrl: article.image
        })).filter(article => article.title && article.summary && article.title.length > 10);
    }
    
    // Fetch news from RSS feeds of major tech publications
    async fetchFromRSSFeeds() {
        const allNews = [];
        let sourceIndex = 0;
        
        for (const source of this.techNewsSources) {
            try {
                const news = await this.fetchFromSingleRSS(source, sourceIndex);
                if (news.length > 0) {
                    allNews.push(...news);
                }
                sourceIndex++;
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.log(`Failed to fetch from ${source.name}:`, error.message);
                sourceIndex++;
            }
        }
        
        return allNews;
    }
    
    // Fetch from a single RSS source
    async fetchFromSingleRSS(source, index) {
        try {
            // Use a CORS proxy for RSS feeds if needed
            const proxyUrl = source.rssUrl.startsWith('https://') ? '' : '';
            const url = proxyUrl + source.rssUrl;
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AI-News-App/1.0)'
                }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const rssText = await response.text();
            
            // Simple RSS parsing (since we don't want to add external dependencies)
            const items = this.parseRSSItems(rssText);
            
            return items.map((item, itemIndex) => {
                // Check if item contains AI-related content
                const content = (item.title + ' ' + (item.description || '')).toLowerCase();
                const aiKeywords = [
                    'ai', 'artificial intelligence', 'machine learning', 'deep learning',
                    'chatgpt', 'openai', 'gemini', 'claude', 'ai model', 'ai tool',
                    'neural network', 'computer vision', 'nlp', 'generative ai',
                    'midjourney', 'stable diffusion', 'llm', 'automation', 'robotics',
                    'deepseek', 'manus', 'kimi', 'qwen', 'moonshot'
                ];
                
                const isAIRelated = aiKeywords.some(keyword => content.includes(keyword));
                
                if (isAIRelated || Math.random() > 0.7) { // Include 30% of non-AI tech news
                    return {
                        id: `rss-${source.name.toLowerCase().replace(/\s+/g, '-')}-${index}-${itemIndex}`,
                        title: item.title || '',
                        summary: item.description || item.summary || '',
                        source: source.name,
                        url: item.link || '',
                        category: this.categorizeNews(item.title + ' ' + (item.description || '')),
                        date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                        publishedAt: item.pubDate || new Date().toISOString(),
                        imageUrl: item.imageUrl || null
                    };
                }
                
                return null;
            }).filter(item => item && item.title && item.title.length > 10);
            
        } catch (error) {
            throw new Error(`RSS fetch failed for ${source.name}: ${error.message}`);
        }
    }
    
    // Simple RSS parser
    parseRSSItems(rssText) {
        const items = [];
        
        // Extract title
        const titleMatches = rssText.match(/<title[^>]*>([\s\S]*?)<\/title>/gi);
        // Extract description/summary
        const descMatches = rssText.match(/<(?:description|summary|content:encoded|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded|content)>/gi);
        // Extract link
        const linkMatches = rssText.match(/<link[^>]*>([\s\S]*?)<\/link>/gi);
        // Extract pubDate
        const dateMatches = rssText.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/gi);
        
        if (titleMatches) {
            const maxItems = Math.min(titleMatches.length, descMatches?.length || 0, linkMatches?.length || 0, 20);
            
            for (let i = 0; i < maxItems; i++) {
                // Skip RSS header items (usually first 1-3)
                if (i < 2) continue;
                
                const title = this.stripHTML(titleMatches[i]).replace(/<title[^>]*>([\s\S]*?)<\/title>/i, '$1').trim();
                const description = descMatches[i] ? this.stripHTML(descMatches[i]).replace(/<(?:description|summary|content:encoded|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded|content)>/i, '$1').trim() : '';
                const link = linkMatches[i] ? linkMatches[i].replace(/<link[^>]*>([\s\S]*?)<\/link>/i, '$1').trim() : '';
                const pubDate = dateMatches[i] ? dateMatches[i].replace(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i, '$1').trim() : '';
                
                if (title && title.length > 5) {
                    items.push({
                        title,
                        description,
                        link,
                        pubDate,
                        imageUrl: this.extractImageFromRSSItem(rssText, i)
                    });
                }
            }
        }
        
        return items;
    }
    
    // Extract image from RSS item
    extractImageFromRSSItem(rssText, itemIndex) {
        try {
            // Look for media:content or enclosure tags
            const mediaMatches = rssText.match(/<media:content[^>]*url=[\"']([^\"']*)[\"'][^>]*>/gi);
            const enclosureMatches = rssText.match(/<enclosure[^>]*url=[\"']([^\"']*)[\"'][^>]*type=[\"']image\//gi);
            
            if (mediaMatches && mediaMatches[itemIndex]) {
                const match = mediaMatches[itemIndex].match(/url=[\"']([^\"']*)[\"']/i);
                if (match) return match[1];
            }
            
            if (enclosureMatches && enclosureMatches[itemIndex]) {
                const match = enclosureMatches[itemIndex].match(/url=[\"']([^\"']*)[\"']/i);
                if (match) return match[1];
            }
        } catch (error) {
            // Ignore image extraction errors
        }
        
        return null;
    }
    
    // Strip HTML tags from text
    stripHTML(html) {
        return html.replace(/<[^>]*>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .trim();
    }
    
    // Fetch news from Hacker News
    async fetchFromHackerNews() {
        try {
            // Get top story IDs
            const response = await fetch(this.hackerNewsUrl);
            if (!response.ok) throw new Error('Hacker News fetch failed');
            
            const storyIds = await response.json();
            const topStoryIds = storyIds.slice(0, 30); // Get top 30 stories
            
            // Fetch details for each story
            const storyPromises = topStoryIds.map(async (id) => {
                try {
                    const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
                    if (!storyResponse.ok) return null;
                    
                    const story = await storyResponse.json();
                    
                    // Filter AI-related stories
                    const title = (story.title || '').toLowerCase();
                    const aiKeywords = [
                        'ai', 'artificial intelligence', 'machine learning', 'deep learning',
                        'chatgpt', 'openai', 'gemini', 'claude', 'neural', 'automation',
                        'robotics', 'deepseek', 'manus', 'kimi', 'algorithm', 'model',
                        'generative', 'classifier', 'predictive', 'data science'
                    ];
                    
                    const isAIRelated = aiKeywords.some(keyword => title.includes(keyword));
                    
                    if (isAIRelated) {
                        return {
                            id: `hackernews-${id}`,
                            title: story.title || '',
                            summary: story.text || `قریب به ${story.score} امتیاز در Hacker News`,
                            source: 'Hacker News',
                            url: `https://news.ycombinator.com/item?id=${id}`,
                            category: this.categorizeNews(story.title || ''),
                            date: story.time ? new Date(story.time * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                            publishedAt: story.time ? new Date(story.time * 1000).toISOString() : new Date().toISOString(),
                            imageUrl: null,
                            score: story.score,
                            comments: story.descendants
                        };
                    }
                    
                    return null;
                } catch (error) {
                    return null;
                }
            });
            
            const stories = await Promise.all(storyPromises);
            return stories.filter(story => story && story.title && story.title.length > 10);
            
        } catch (error) {
            throw new Error(`Hacker News fetch failed: ${error.message}`);
        }
    }

    // Categorize news based on content with enhanced AI platform detection
    categorizeNews(content) {
        const lowerContent = content.toLowerCase();
        
        // OpenAI & ChatGPT
        if (lowerContent.includes('chatgpt') || lowerContent.includes('openai') || lowerContent.includes('gpt-4') || lowerContent.includes('gpt-5') || lowerContent.includes('dall-e') || lowerContent.includes('whisper')) {
            return 'openai';
        }
        // Google AI & Gemini
        else if (lowerContent.includes('gemini') || lowerContent.includes('bard') || lowerContent.includes('google ai') || lowerContent.includes('palm') || lowerContent.includes('lamda')) {
            return 'google-ai';
        }
        // Anthropic Claude
        else if (lowerContent.includes('claude') || lowerContent.includes('anthropic') || lowerContent.includes('constitutional ai')) {
            return 'claude';
        }
        // Chinese AI Platforms
        else if (lowerContent.includes('deepseek') || lowerContent.includes('deep seek') || lowerContent.includes('qwen') || lowerContent.includes('alibaba ai') || lowerContent.includes('alibaba')) {
            return 'chinese-ai';
        }
        else if (lowerContent.includes('kimi') || lowerContent.includes('moonshot ai') || lowerContent.includes('moonshot')) {
            return 'chinese-ai';
        }
        else if (lowerContent.includes('manus') || lowerContent.includes('manus ai') || lowerContent.includes('manus ai platform')) {
            return 'chinese-ai';
        }
        // Microsoft AI
        else if (lowerContent.includes('microsoft ai') || lowerContent.includes('copilot') || lowerContent.includes('azure ai') || lowerContent.includes('cortana')) {
            return 'microsoft-ai';
        }
        // Meta AI
        else if (lowerContent.includes('meta ai') || lowerContent.includes('llama') || lowerContent.includes('facebook ai') || lowerContent.includes('ray ban meta')) {
            return 'meta-ai';
        }
        // Image generation tools
        else if (lowerContent.includes('midjourney') || lowerContent.includes('stable diffusion') || lowerContent.includes('dall-e') || lowerContent.includes('leonardo.ai') || lowerContent.includes('runway') || lowerContent.includes('adobe firefly')) {
            return 'image-tools';
        }
        // Video generation
        else if (lowerContent.includes('sora') || lowerContent.includes('runwayml') || lowerContent.includes('pika') || lowerContent.includes('synthesia') || lowerContent.includes('ai video')) {
            return 'video-tools';
        }
        // Robotics
        else if (lowerContent.includes('robot') || lowerContent.includes('robotics') || lowerContent.includes('boston dynamics') || lowerContent.includes('tesla bot') || lowerContent.includes('humanoid')) {
            return 'robotics';
        }
        // Computer Vision & Image Processing
        else if (lowerContent.includes('computer vision') || lowerContent.includes('image recognition') || lowerContent.includes('visual') || lowerContent.includes('facial recognition') || lowerContent.includes('object detection')) {
            return 'computer-vision';
        }
        // Natural Language & NLP
        else if (lowerContent.includes('natural language') || lowerContent.includes('nlp') || lowerContent.includes('language model') || lowerContent.includes('text generation') || lowerContent.includes('sentiment analysis')) {
            return 'nlp';
        }
        // AI Tools & Applications
        else if (lowerContent.includes('ai tool') || lowerContent.includes('ai app') || lowerContent.includes('ai platform') || lowerContent.includes('ai software') || lowerContent.includes('chatbot') || lowerContent.includes('ai assistant')) {
            return 'ai-tools';
        }
        // Deep Learning & Neural Networks
        else if (lowerContent.includes('deep learning') || lowerContent.includes('neural network') || lowerContent.includes('transformer') || lowerContent.includes('attention')) {
            return 'deep-learning';
        }
        // AI Safety & Ethics
        else if (lowerContent.includes('ai safety') || lowerContent.includes('ai ethics') || lowerContent.includes('responsible ai') || lowerContent.includes('ai alignment')) {
            return 'ai-safety';
        }
        // Hardware & AI Chips
        else if (lowerContent.includes('nvidia') || lowerContent.includes('gpu') || lowerContent.includes('tpu') || lowerContent.includes('ai chip') || lowerContent.includes('neural chip')) {
            return 'ai-hardware';
        }
        // General Machine Learning
        else {
            return 'machine-learning';
        }
    }
    
    // Persian Translation using multiple methods
    async translateToPersian(text) {
        if (!text || text.trim().length === 0) return '';
        
        // Check cache first
        const cacheKey = text.substring(0, 100);
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }
        
        try {
            // Method 1: Try Google Translate API (if available)
            if (this.apiKeys.translate && this.apiKeys.translate !== 'YOUR_TRANSLATE_API_KEY') {
                const translated = await this.translateWithGoogle(text);
                if (translated) {
                    this.translationCache.set(cacheKey, translated);
                    return translated;
                }
            }
            
            // Method 2: Fallback to manual translation for common AI terms
            const manualTranslation = this.translateManually(text);
            this.translationCache.set(cacheKey, manualTranslation);
            return manualTranslation;
            
        } catch (error) {
            console.log('Translation failed, using manual:', error);
            const fallback = this.translateManually(text);
            this.translationCache.set(cacheKey, fallback);
            return fallback;
        }
    }
    
    // Google Translate API call
    async translateWithGoogle(text) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fa&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Translation API failed');
        
        const data = await response.json();
        if (data && data[0] && data[0][0]) {
            return data[0][0][0];
        }
        return null;
    }
    
    // Manual translation for common AI terms
    translateManually(text) {
        const translations = {
            // AI Platform Names - Major Players
            'OpenAI': 'اوپن‌ای‌آی',
            'ChatGPT': 'چت‌جی‌پی‌تی',
            'GPT-4': 'جی‌پی‌تی-۴',
            'GPT-5': 'جی‌پی‌تی-۵',
            'Google': 'گوگل',
            'Gemini': 'جمینی',
            'Bard': 'بارد',
            'Anthropic': 'آنترپیک',
            'Claude': 'کلاد',
            'Microsoft': 'مایکروسافت',
            'Meta': 'متا',
            'Facebook': 'فیسبوک',
            'Alibaba': 'علی‌بابا',
            
            // Chinese AI Platforms
            'DeepSeek': 'دیپ‌سیک',
            'Deep Seek': 'دیپ‌سیک',
            'Qwen': 'کیوئن',
            'Kimi': 'کیمی',
            'Moonshot AI': 'ماه‌شات ای‌آی',
            'Manus': 'مانوس',
            'Manus AI': 'مانوس ای‌آی',
            'Moonshot': 'ماه‌شات',
            
            // AI Tools & Services
            'DALL-E': 'دال‌ای',
            'Midjourney': 'میدجرنی',
            'Stable Diffusion': 'استیبل دیفیوژن',
            'Runway': 'رانوی',
            'Leonardo AI': 'لئوناردو ای‌آی',
            'Adobe Firefly': 'ادوبی فایرلای',
            'Sora': 'سورا',
            'Pika': 'پیکا',
            'Synthesia': 'سینتسیا',
            
            // AI Concepts & Terms
            'Artificial Intelligence': 'هوش مصنوعی',
            'AI': 'هوش مصنوعی',
            'Machine Learning': 'یادگیری ماشین',
            'Deep Learning': 'یادگیری عمیق',
            'Neural Network': 'شبکه عصبی',
            'Large Language Model': 'مدل زبانی بزرگ',
            'LLM': 'ال‌ال‌ام',
            'Computer Vision': 'بینایی کامپیوتر',
            'Natural Language Processing': 'پردازش زبان طبیعی',
            'Generative AI': 'هوش مصنوعی مولد',
            'AI Assistant': 'دستیار هوش مصنوعی',
            'AI Tool': 'ابزار هوش مصنوعی',
            'AI Platform': 'پلتفرم هوش مصنوعی',
            'AI Model': 'مدل هوش مصنوعی',
            'AI Technology': 'فناوری هوش مصنوعی',
            'AI Development': 'توسعه هوش مصنوعی',
            'AI Research': 'تحقیقات هوش مصنوعی',
            'AI Innovation': 'نوآوری هوش مصنوعی',
            'AI Breakthrough': 'پیشرفت هوش مصنوعی',
            'AI Company': 'شرکت هوش مصنوعی',
            'AI Startup': 'استارتاپ هوش مصنوعی',
            'AI Ecosystem': 'اکوسیستم هوش مصنوعی',
            'AI Industry': 'صنعت هوش مصنوعی',
            'AI Market': 'بازار هوش مصنوعی',
            
            // AI Applications
            'Chatbot': 'چت‌بات',
            'Text Generation': 'تولید متن',
            'Image Generation': 'تولید تصویر',
            'Video Generation': 'تولید ویدیو',
            'Code Generation': 'تولید کد',
            'AI Assistant': 'دستیار هوش مصنوعی',
            'Virtual Assistant': 'دستیار مجازی',
            'AI Copilot': 'کوپایلوت هوش مصنوعی',
            
            // Common Action Words
            'announces': 'اعلام کرد',
            'launches': 'راه‌اندازی کرد',
            'releases': 'منتشر کرد',
            'introduces': 'معرفی کرد',
            'reveals': 'آشکار کرد',
            'unveils': 'رونمایی کرد',
            'solves': 'حل کرد',
            'achieves': 'دست یافت',
            'breaks': 'شکست',
            'surpasses': 'از آن سبقت گرفت',
            'outperforms': 'عملکرد بهتری نشان داد',
            
            // Quality Descriptors
            'breakthrough': 'پیشرفت انقلابی',
            'innovation': 'نوآوری',
            'technology': 'فناوری',
            'system': 'سیستم',
            'platform': 'پلتفرم',
            'tool': 'ابزار',
            'new': 'جدید',
            'latest': 'جدیدترین',
            'advanced': 'پیشرفته',
            'revolutionary': 'انقلابی',
            'cutting-edge': 'پیشرفته',
            'powerful': 'قدرتمند',
            'intelligent': 'هوشمند',
            'smart': 'هوشمند',
            'sophisticated': 'پیشرفته',
            'enhanced': 'بهبود یافته',
            'improved': 'بهبود یافته',
            'next-generation': 'نسل بعدی',
            'state-of-the-art': 'پیشرفته',
            'world-class': 'در کلاس جهانی'
        };
        
        let translated = text;
        for (const [english, persian] of Object.entries(translations)) {
            translated = translated.replace(new RegExp(english, 'gi'), persian);
        }
        
        // If no translation was applied, use Google Translate as fallback
        if (translated === text) {
            translated = this.googleTranslateFallback(text);
        }
        
        return translated;
    }
    
    // Fallback translation using Google Translate web service
    googleTranslateFallback(text) {
        try {
            // Simple URL-based translation (may not work due to CORS)
            const encoded = encodeURIComponent(text);
            return text; // Return original text if translation fails
        } catch (error) {
            return text;
        }
    }
    // Process and clean news data with Persian translation
    async processNewsData(news) {
        const processedNews = [];
        
        for (const article of news) {
            try {
                // Translate title and summary to Persian
                const translatedTitle = await this.translateToPersian(article.title);
                const translatedSummary = await this.translateToPersian(article.summary);
                
                // Create summarized version
                const summarizedSummary = this.createPersianSummary(translatedSummary);
                
                processedNews.push({
                    ...article,
                    title: this.cleanTitle(translatedTitle),
                    summary: this.cleanSummary(summarizedSummary),
                    source: this.cleanSource(article.source),
                    originalTitle: article.title, // Keep original for reference
                    originalSummary: article.summary
                });
            } catch (error) {
                console.log('Failed to process article:', error);
                // Fallback to original content
                processedNews.push({
                    ...article,
                    title: this.cleanTitle(article.title),
                    summary: this.cleanSummary(article.summary),
                    source: this.cleanSource(article.source)
                });
            }
        }
        
        return processedNews.filter(article => 
            article.title && 
            article.title.length > 10 && 
            article.summary && 
            article.summary.length > 20
        );
    }
    
    // Create smart Persian summary
    createPersianSummary(persianText) {
        if (!persianText) return '';
        
        // Extract key information from the summary
        const keyTerms = [
            'نوآوری', 'تکنولوژی', 'فناوری', 'هوش مصنوعی', 'AI', 'مدل', 'سیستم', 'پلتفرم',
            'ابزار', 'کشف', 'پیشرفت', 'دستاورد', 'راه‌اندازی', 'معرفی', 'عرضه', 'انقلابی'
        ];
        
        // If text is too long, truncate with smart logic
        if (persianText.length > 150) {
            const sentences = persianText.split(/[.!?]+/);
            let summary = '';
            
            // Take first sentence
            if (sentences[0] && sentences[0].length > 20) {
                summary = sentences[0] + '.';
            }
            
            // Add key terms if they appear
            const keyPhrases = keyTerms.filter(term => 
                persianText.toLowerCase().includes(term.toLowerCase())
            );
            
            if (keyPhrases.length > 0 && summary.length < 100) {
                summary += ` شامل ${keyPhrases.slice(0, 2).join(' و ')}`;
            }
            
            return summary.length < 20 ? persianText.substring(0, 147) + '...' : summary;
        }
        
        return persianText;
    }
    
    // Clean summary text
    cleanSummary(summary) {
        if (!summary) return '';
        
        // Remove common prefixes and suffixes
        let cleaned = summary.replace(/^Read more.*$/i, '')
                            .replace(/^Full story.*$/i, '')
                            .replace(/^More.*$/i, '')
                            .replace(/\s+/g, ' ')
                            .trim();
        
        // Limit length
        if (cleaned.length > 200) {
            cleaned = cleaned.substring(0, 197) + '...';
        }
        
        return cleaned;
    }
    
    // Clean title text
    cleanTitle(title) {
        if (!title) return '';
        
        let cleaned = title.replace(/^BREAKING:\s*/i, '')
                          .replace(/^UPDATE:\s*/i, '')
                          .trim();
        
        return cleaned;
    }
    
    // Clean source name
    cleanSource(source) {
        if (!source) return 'Unknown';
        
        // Handle common source names
        const sourceMap = {
            'TechCrunch': 'TechCrunch',
            'The Verge': 'The Verge',
            'Wired': 'Wired',
            'MIT Technology Review': 'MIT Technology Review',
            'OpenAI Blog': 'OpenAI',
            'Google AI Blog': 'Google AI',
            'DeepMind Blog': 'DeepMind',
            'Ars Technica': 'Ars Technica'
        };
        
        return sourceMap[source] || source;
    }
    
    // Get fallback news when APIs fail
    getFallbackNews() {
        // Return cached news if available and not expired
        if (this.cachedNews && (Date.now() - this.cachedNews.timestamp < this.cacheExpiry)) {
            return this.processNewsData(this.cachedNews.data);
        }
        
        // Return sample news
        return this.getSampleNews();
    }
    
    // Sample news data for fallback with comprehensive AI coverage
    getSampleNews() {
        return [
            {
                id: 1,
                title: "OpenAI Releases GPT-5 with Breakthrough Reasoning",
                summary: "OpenAI announces GPT-5, featuring unprecedented reasoning capabilities and multimodal understanding. The model demonstrates significant improvements in complex problem-solving and creative tasks.",
                source: "OpenAI",
                url: "https://openai.com/blog/gpt-5",
                category: "openai",
                date: new Date().toISOString().split('T')[0],
                publishedAt: new Date().toISOString()
            },
            {
                id: 2,
                title: "Google's Gemini Pro: Revolutionary AI Integration",
                summary: "Google introduces Gemini Pro, an advanced AI system that seamlessly integrates across Google services, offering enhanced productivity and creative assistance worldwide.",
                source: "Google AI",
                url: "https://ai.googleblog.com/gemini-pro",
                category: "google-ai",
                date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 3,
                title: "Anthropic's Claude 3 Opus Achieves New Benchmarks",
                summary: "Anthropic releases Claude 3 Opus with superior performance in reasoning, math, and code generation, challenging OpenAI's dominance in language models.",
                source: "Anthropic",
                url: "https://anthropic.com/claude-3-opus",
                category: "claude",
                date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 172800000).toISOString()
            },
            {
                id: 4,
                title: "DeepSeek-V3 Sets New Records in Code Generation",
                summary: "Chinese AI company DeepSeek unveils V3 model with exceptional coding capabilities, outperforming leading Western models in several benchmarks.",
                source: "DeepSeek",
                url: "https://deepseek.com/v3-release",
                category: "chinese-ai",
                date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 259200000).toISOString()
            },
            {
                id: 5,
                title: "Kimi Moonshot AI Launches Multimodal Capabilities",
                summary: "Moonshot AI releases Kimi with advanced multimodal understanding, combining text, image, and video processing in a single platform.",
                source: "Moonshot AI",
                url: "https://moonshot.cn/kimi-multimodal",
                category: "chinese-ai",
                date: new Date(Date.now() - 345600000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 345600000).toISOString()
            },
            {
                id: 6,
                title: "Midjourney V6 Delivers Photorealistic Image Generation",
                summary: "Midjourney releases version 6 with unprecedented photorealistic image generation capabilities, setting new standards in AI art creation.",
                source: "Midjourney",
                url: "https://midjourney.com/v6",
                category: "image-tools",
                date: new Date(Date.now() - 432000000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 432000000).toISOString()
            },
            {
                id: 7,
                title: "Sora Generates 60-Second Videos from Text Prompts",
                summary: "OpenAI's Sora creates stunning 60-second videos from simple text descriptions, revolutionizing video content creation for creators.",
                source: "OpenAI",
                url: "https://openai.com/sora",
                category: "video-tools",
                date: new Date(Date.now() - 518400000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 518400000).toISOString()
            },
            {
                id: 8,
                title: "Manus AI Platform Launches Enterprise Solutions",
                summary: "Manus AI introduces enterprise-grade AI tools for automation and data analysis, targeting business transformation.",
                source: "Manus AI",
                url: "https://manus.ai/enterprise",
                category: "ai-tools",
                date: new Date(Date.now() - 604800000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 604800000).toISOString()
            }
        ];
    }
    
    // Check if cache is valid
    isCacheValid() {
        return this.cachedNews && (Date.now() - this.cachedNews.timestamp < this.cacheExpiry);
    }
    
    // Clear cache
    clearCache() {
        this.cachedNews = null;
    }
    
    // Get news with automatic fallback and Persian translation
    async getNews(forceRefresh = false) {
        if (forceRefresh || !this.isCacheValid()) {
            const news = await this.fetchAINews();
            // Store original news for caching
            this.cachedNews = {
                data: news,
                timestamp: Date.now()
            };
            return this.processNewsData(news);
        } else {
            return this.processNewsData(this.cachedNews.data);
        }
    }
}

// Initialize the service
const aiNewsService = new AINewsService();

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.AINewsService = aiNewsService;
}

// For Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AINewsService;
}