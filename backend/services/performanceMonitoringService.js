/**
 * Performance Monitoring Service
 * Tracks system performance and alerts on issues
 */
class PerformanceMonitoringService {
  constructor() {
    this.metrics = {
      apiRequests: [],
      databaseQueries: [],
      slowQueries: []
    };
  }
  
  /**
   * Track API response time middleware
   */
  trackAPIMetrics() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log slow requests
        if (duration > 1000) {
          console.warn(`Slow API request: ${req.method} ${req.path} took ${duration}ms`);
          
          this.metrics.slowQueries.push({
            method: req.method,
            path: req.path,
            duration,
            statusCode: res.statusCode,
            timestamp: new Date()
          });
        }
        
        // Store metrics (in production, use a proper metrics store)
        this.metrics.apiRequests.push({
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          timestamp: new Date()
        });
        
        // Keep only last 1000 requests in memory
        if (this.metrics.apiRequests.length > 1000) {
          this.metrics.apiRequests.shift();
        }
      });
      
      next();
    };
  }
  
  /**
   * Monitor database performance
   */
  async monitorDatabasePerformance() {
    // MongoDB removed; use Postgres monitoring tools for DB stats
    return null;
  }
  
  /**
   * Check performance thresholds and alert
   */
  async checkPerformanceThresholds() {
    const alerts = [];
    
    // Check API response times
    const recentRequests = this.metrics.apiRequests.filter(
      r => r.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
    );
    
    const slowRequests = recentRequests.filter(r => r.duration > 5000); // > 5 seconds
    
    if (slowRequests.length > 10) {
      alerts.push({
        type: 'performance_degradation',
        severity: 'high',
        message: `${slowRequests.length} slow requests (>5s) in the last hour`,
        details: slowRequests.slice(0, 10) // First 10
      });
    }
    
    // Check database size
    const dbStats = await this.monitorDatabasePerformance();
    if (dbStats) {
      const dataSizeGB = dbStats.dataSize / (1024 * 1024 * 1024);
      
      if (dataSizeGB > 10) { // > 10GB
        alerts.push({
          type: 'database_size_warning',
          severity: 'medium',
          message: `Database size is ${dataSizeGB.toFixed(2)}GB`,
          dataSize: dbStats.dataSize,
          dataSizeGB
        });
      }
      
      // Check if database is approaching limits
      if (dbStats.storageSize > 0) {
        const utilizationPercent = (dbStats.dataSize / dbStats.storageSize) * 100;
        if (utilizationPercent > 80) {
          alerts.push({
            type: 'database_storage_warning',
            severity: 'high',
            message: `Database storage ${utilizationPercent.toFixed(2)}% utilized`,
            utilizationPercent
          });
        }
      }
    }
    
    return alerts;
  }
  
  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const recentRequests = this.metrics.apiRequests.filter(
      r => r.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
    );
    
    if (recentRequests.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        slowRequests: 0
      };
    }
    
    const totalDuration = recentRequests.reduce((sum, r) => sum + r.duration, 0);
    const avgResponseTime = totalDuration / recentRequests.length;
    const slowRequests = recentRequests.filter(r => r.duration > 1000).length;
    
    return {
      totalRequests: recentRequests.length,
      avgResponseTime: Math.round(avgResponseTime),
      slowRequests,
      p95ResponseTime: this.calculatePercentile(recentRequests.map(r => r.duration), 95),
      p99ResponseTime: this.calculatePercentile(recentRequests.map(r => r.duration), 99)
    };
  }
  
  /**
   * Calculate percentile
   */
  calculatePercentile(values, percentile) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }
  
  /**
   * Schedule performance monitoring
   */
  scheduleMonitoring() {
    const cron = require('node-cron');
    
    // Check performance every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        const alerts = await this.checkPerformanceThresholds();
        
        if (alerts.length > 0) {
          console.warn('Performance alerts:', alerts);
          
          // TODO: Send alerts
          // for (const alert of alerts) {
          //   await sendAlert(alert);
          // }
        }
      } catch (error) {
        console.error('Error in performance monitoring:', error);
      }
    });
    
    // Monitor database daily at midnight
    cron.schedule('0 0 * * *', async () => {
      try {
        const stats = await this.monitorDatabasePerformance();
        if (stats) {
          console.log('Daily database stats:', stats);
          
          // TODO: Store in metrics collection
          // await DatabaseMetric.create(stats);
        }
      } catch (error) {
        console.error('Error in database monitoring:', error);
      }
    });
  }
}

module.exports = new PerformanceMonitoringService();

