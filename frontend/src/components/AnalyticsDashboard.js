import React, { useState, useEffect } from 'react';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [timeRange, setTimeRange] = useState('today');

  useEffect(() => {
    fetchAnalytics();
    setupLiveUpdates();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/dashboard');
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const setupLiveUpdates = () => {
    const eventSource = new EventSource('/api/analytics/live');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLiveData(data);
    };

    return () => eventSource.close();
  };

  if (!analytics) {
    return React.createElement('div', { className: 'analytics-loading' },
      React.createElement('div', { className: 'loading-spinner' }),
      React.createElement('p', null, 'Loading accessibility analytics...')
    );
  }

  return React.createElement('div', { className: 'analytics-dashboard' },
    // Header
    React.createElement('div', { className: 'analytics-header' },
      React.createElement('h2', null, '📊 Accessibility Impact Dashboard'),
      React.createElement('p', null, 'Real-time tracking of how VoiceAssist is making content accessible'),
      React.createElement('div', { className: 'live-indicator' },
        React.createElement('span', { className: 'pulse' }),
        'LIVE • ' + (liveData?.activeNow || 0) + ' people using now'
      )
    ),

    // Impact Metrics
    React.createElement('div', { className: 'impact-metrics' },
      React.createElement('h3', null, '🌍 Social Impact'),
      React.createElement('div', { className: 'metrics-grid' },
        createMetricCard('⏰', analytics.accessibilityImpact.timeSavedFormatted, 'Time Saved', 'For people with reading difficulties', 'primary'),
        createMetricCard('📄', analytics.accessibilityImpact.documentsMadeAccessible.toLocaleString(), 'Documents Made Accessible', 'Content unlocked for everyone', 'success'),
        createMetricCard('👥', analytics.accessibilityImpact.estimatedPeopleHelped.toLocaleString() + '+', 'People Helped', 'Estimated users benefited', 'warning'),
        createMetricCard('🌱', analytics.accessibilityImpact.carbonFootprintSaved + ' kg', 'CO₂ Saved', 'Equivalent to ' + analytics.accessibilityImpact.treesEquivalent + ' trees', 'info')
      )
    ),

    // Usage Statistics
    React.createElement('div', { className: 'usage-section' },
      createUsageColumn('📈 Usage Overview', createStatsGrid(analytics)),
      createUsageColumn('🎯 Feature Usage', createFeatureStats(analytics))
    ),

    // Language & Voice Distribution
    React.createElement('div', { className: 'distribution-section' },
      createDistributionColumn('🌐 Top Languages', analytics.usage.languages, true),
      createDistributionColumn('🎙️ Popular Voices', analytics.usage.voices, false)
    ),

    // Real-time Activity
    React.createElement('div', { className: 'realtime-section' },
      React.createElement('h3', null, '⚡ Real-time Activity'),
      React.createElement('div', { className: 'realtime-grid' },
        createRealtimeCard(analytics.realTime.requestsThisHour, 'Requests This Hour'),
        createRealtimeCard(analytics.realTime.averageProcessingTime, 'Avg. Processing Time'),
        createRealtimeCard(analytics.realTime.successRate, 'Success Rate'),
        createRealtimeCard(analytics.trends.popularTime, 'Peak Usage Time')
      )
    ),

    // Hourly Usage Chart
    React.createElement('div', { className: 'chart-section' },
      React.createElement('h3', null, '📅 Hourly Usage Pattern'),
      createHourlyChart(analytics)
    ),

    // Growth Metrics
    React.createElement('div', { className: 'growth-section' },
      React.createElement('h3', null, '📊 Growth Trends'),
      React.createElement('div', { className: 'growth-cards' },
        createGrowthCard(analytics.trends.dailyGrowth >= 0 ? '+' + analytics.trends.dailyGrowth + '%' : analytics.trends.dailyGrowth + '%', 'Daily Growth', analytics.trends.dailyGrowth >= 0),
        createGrowthCard(analytics.trends.busiestDay, 'Busiest Day'),
        createGrowthCard(Math.round(analytics.overview.uptime / 3600) + 'h', 'System Uptime')
      )
    )
  );
};

// Helper component functions
function createMetricCard(icon, value, label, description, type) {
  return React.createElement('div', { className: 'metric-card ' + type, key: label },
    React.createElement('div', { className: 'metric-icon' }, icon),
    React.createElement('div', { className: 'metric-value' }, value),
    React.createElement('div', { className: 'metric-label' }, label),
    React.createElement('div', { className: 'metric-description' }, description)
  );
}

function createStatsGrid(analytics) {
  const stats = [
    { number: analytics.overview.totalRequests.toLocaleString(), label: 'Total Conversions' },
    { number: analytics.overview.totalCharacters.toLocaleString(), label: 'Characters Processed' },
    { number: analytics.overview.totalLanguages, label: 'Languages Supported' },
    { number: analytics.overview.activeToday, label: 'Active Today' }
  ];

  return React.createElement('div', { className: 'stats-grid' },
    stats.map(stat => 
      React.createElement('div', { className: 'stat-item', key: stat.label },
        React.createElement('div', { className: 'stat-number' }, stat.number),
        React.createElement('div', { className: 'stat-label' }, stat.label)
      )
    )
  );
}

function createFeatureStats(analytics) {
  return React.createElement('div', { className: 'feature-stats' },
    analytics.usage.features.map(feature => 
      React.createElement('div', { className: 'feature-bar', key: feature.feature },
        React.createElement('div', { className: 'feature-name' }, getFeatureName(feature.feature)),
        React.createElement('div', { className: 'feature-progress' },
          React.createElement('div', { 
            className: 'feature-progress-bar',
            style: { width: feature.percentage + '%' }
          })
        ),
        React.createElement('div', { className: 'feature-percentage' }, feature.percentage + '%')
      )
    )
  );
}

function getFeatureName(feature) {
  const names = {
    'text': '📖 Text Reader',
    'document': '📄 Documents',
    'realtime': '⚡ Real-time',
    'batch': '📦 Batch Processing'
  };
  return names[feature] || feature;
}

function createUsageColumn(title, content) {
  return React.createElement('div', { className: 'usage-column' },
    React.createElement('h3', null, title),
    content
  );
}

function createDistributionColumn(title, items, isLanguage) {
  return React.createElement('div', { className: 'distribution-column' },
    React.createElement('h3', null, title),
    React.createElement('div', { className: 'distribution-list' },
      items.map((item, index) => 
        React.createElement('div', { className: 'distribution-item', key: item.language || item.voice },
          React.createElement('span', { className: 'distribution-rank' }, '#' + (index + 1)),
          React.createElement('span', { className: 'distribution-name' }, 
            isLanguage ? getLanguageName(item.language) : formatVoiceName(item.voice)
          ),
          React.createElement('span', { className: 'distribution-count' }, item.count.toLocaleString())
        )
      )
    )
  );
}

function getLanguageName(code) {
  const languages = {
    'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi', 'te': 'Telugu',
    'ta': 'Tamil', 'kn': 'Kannada', 'gu': 'Gujarati', 'ml': 'Malayalam',
    'bn': 'Bengali', 'pa': 'Punjabi'
  };
  return languages[code] || code;
}

function formatVoiceName(voice) {
  return voice.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function createRealtimeCard(value, label) {
  return React.createElement('div', { className: 'realtime-card' },
    React.createElement('div', { className: 'realtime-value' }, value),
    React.createElement('div', { className: 'realtime-label' }, label)
  );
}

function createHourlyChart(analytics) {
  const maxRequests = Math.max(...analytics.usage.hourly.map(h => h.requests));
  
  return React.createElement('div', { className: 'hourly-chart' },
    analytics.usage.hourly.map((hourData, index) =>
      React.createElement('div', { className: 'hour-bar', key: index },
        React.createElement('div', { 
          className: 'bar-fill',
          style: { 
            height: (hourData.requests / maxRequests) * 100 + '%'
          }
        }),
        React.createElement('div', { className: 'hour-label' }, hourData.hour),
        React.createElement('div', { className: 'hour-count' }, hourData.requests)
      )
    )
  );
}

function createGrowthCard(value, label, isPositive = true) {
  const className = 'growth-value ' + (isPositive ? 'positive' : 'negative');
  
  return React.createElement('div', { className: 'growth-card' },
    React.createElement('div', { className: className }, value),
    React.createElement('div', { className: 'growth-label' }, label)
  );
}

export default AnalyticsDashboard;