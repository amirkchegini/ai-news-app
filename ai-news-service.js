// AI News API Service
class AINewsService {
    constructor() {
        this.apiKeys = {
            // Free tier API keys - replace with your own for production
            newsapi: 'YOUR_NEWSAPI_KEY',
            gnews: 'YOUR_GNEWS_API_KEY'
        };
        this.cachedNews = null;
        this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    }
    
    // Fetch news from multiple sources
    async fetchAINews() {
        try {
            // Try to fetch from real APIs first
            const [newsApiNews, gNews] = await Promise.allSettled([
                this.fetchFromNewsAPI(),
                this.fetchFromGNews()
            ]);
            
            let combinedNews = [];
            
            if (newsApiNews.status === 'fulfilled') {
                combinedNews = combinedNews.concat(newsApiNews.value);
            }
            
            if (gNews.status === 'fulfilled') {
                combinedNews = combinedNews.concat(gNews.value);
            }
            
            // If we got real news, use them; otherwise use fallback
            if (combinedNews.length > 0) {
                this.cachedNews = {
                    data: combinedNews,
                    timestamp: Date.now()
                };
                return this.processNewsData(combinedNews);
            } else {
                throw new Error('No news from APIs');
            }
            
        } catch (error) {
            console.log('API fetch failed, using cached/fallback news:', error);
            return this.getFallbackNews();
        }
    }
    
    // Fetch from NewsAPI.org
    async fetchFromNewsAPI() {
        const query = 'artificial intelligence OR AI OR "machine learning" OR "deep learning" OR ChatGPT OR OpenAI';
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${this.apiKeys.newsapi}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('NewsAPI request failed');
        
        const data = await response.json();
        
        return data.articles.map((article, index) => ({
            id: `newsapi-${index}`,
            title: article.title || '',
            summary: article.description || article.content || '',
            source: article.source?.name || 'News API',
            url: article.url || '',
            category: this.categorizeNews(article.title + ' ' + (article.description || '')),
            date: article.publishedAt ? new Date(article.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            publishedAt: article.publishedAt || new Date().toISOString(),
            imageUrl: article.urlToImage
        })).filter(article => article.title && article.summary);
    }
    
    // Fetch from GNews API
    async fetchFromGNews() {
        const query = 'artificial intelligence OR AI OR machine learning OR ChatGPT OR OpenAI';
        const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&country=us&max=20&apikey=${this.apiKeys.gnews}`;
        
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
        })).filter(article => article.title && article.summary);
    }
    
    // Categorize news based on content
    categorizeNews(content) {
        const lowerContent = content.toLowerCase();
        
        if (lowerContent.includes('chatgpt') || lowerContent.includes('openai')) {
            return 'chatgpt';
        } else if (lowerContent.includes('robot') || lowerContent.includes('robotics')) {
            return 'robotics';
        } else if (lowerContent.includes('computer vision') || lowerContent.includes('image recognition') || lowerContent.includes('visual')) {
            return 'computer-vision';
        } else if (lowerContent.includes('natural language') || lowerContent.includes('nlp') || lowerContent.includes('language model')) {
            return 'nlp';
        } else if (lowerContent.includes('deep learning') || lowerContent.includes('neural network')) {
            return 'deep-learning';
        } else {
            return 'machine-learning';
        }
    }
    
    // Process and clean news data
    processNewsData(news) {
        return news.map(article => ({
            ...article,
            summary: this.cleanSummary(article.summary),
            title: this.cleanTitle(article.title),
            source: this.cleanSource(article.source)
        })).filter(article => 
            article.title && 
            article.title.length > 10 && 
            article.summary && 
            article.summary.length > 20
        );
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
    
    // Sample news data for fallback
    getSampleNews() {
        return [
            {
                id: 1,
                title: "OpenAI Announces GPT-5 with Revolutionary Capabilities",
                summary: "OpenAI has unveiled GPT-5, featuring unprecedented reasoning abilities and multimodal understanding. The new model demonstrates significant improvements in complex problem-solving and creative tasks.",
                source: "OpenAI",
                url: "https://openai.com/blog/gpt-5",
                category: "chatgpt",
                date: new Date().toISOString().split('T')[0],
                publishedAt: new Date().toISOString()
            },
            {
                id: 2,
                title: "Google's Gemini Pro: Next-Generation AI Assistant",
                summary: "Google introduces Gemini Pro, an advanced AI system that seamlessly integrates across Google services, offering enhanced productivity and creative assistance for users worldwide.",
                source: "Google AI",
                url: "https://ai.googleblog.com/gemini-pro",
                category: "deep-learning",
                date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 3,
                title: "MIT Researchers Develop AI for Cancer Drug Discovery",
                summary: "MIT scientists have created an AI system that identified promising new compounds for cancer treatment, showing remarkable success in early clinical trials and potentially revolutionizing drug discovery.",
                source: "MIT Technology Review",
                url: "https://www.technologyreview.com/ai-cancer-discovery",
                category: "machine-learning",
                date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 172800000).toISOString()
            },
            {
                id: 4,
                title: "Boston Dynamics' New Robot: Advanced Learning Capabilities",
                summary: "Boston Dynamics has unveiled a new humanoid robot that learns complex tasks through demonstration and can adapt to new environments in real-time, marking a significant advancement in robotics.",
                source: "Boston Dynamics",
                url: "https://bostondynamics.com/new-robot",
                category: "robotics",
                date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 259200000).toISOString()
            },
            {
                id: 5,
                title: "Meta's AI Translation System Breaks Language Barriers",
                summary: "Meta has launched an AI-powered translation system that can translate between 200+ languages with near-human accuracy, enabling seamless communication across cultures and languages.",
                source: "Meta AI",
                url: "https://ai.meta.com/translation-breakthrough",
                category: "nlp",
                date: new Date(Date.now() - 345600000).toISOString().split('T')[0],
                publishedAt: new Date(Date.now() - 345600000).toISOString()
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
    
    // Get news with automatic fallback
    async getNews(forceRefresh = false) {
        if (forceRefresh || !this.isCacheValid()) {
            return await this.fetchAINews();
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