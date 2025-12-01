import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Zap, 
  Flame, 
  Award, 
  Palette, 
  Target,
  Clock,
  Star,
  Sparkles,
  ChevronRight,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus,
  Crown,
  Lightbulb,
  X
} from 'lucide-react';
import { insightsService } from '../../services/insightsService';
import type { 
  UserInsights, 
  WeeklyInsightsSummary, 
  TrendingStyle, 
  PersonalRecommendation
} from '../../types/advanced';

interface InsightsDashboardProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({
  userId,
  isOpen,
  onClose
}) => {
  const [insights, setInsights] = useState<UserInsights | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklyInsightsSummary | null>(null);
  const [trendingStyles, setTrendingStyles] = useState<TrendingStyle[]>([]);
  const [recommendations, setRecommendations] = useState<PersonalRecommendation[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'recommendations' | 'achievements'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId) {
      loadInsights();
    }
  }, [isOpen, userId]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const [userInsights, trends, recs] = await Promise.all([
        insightsService.getUserInsights(userId),
        insightsService.getTrendingStyles(),
        insightsService.generateRecommendations(userId)
      ]);

      setInsights(userInsights);
      // Build weekly summary from user insights
      if (userInsights) {
        setWeeklySummary({
          generation_count: userInsights.total_visuals || 0,
          total_reactions: userInsights.total_reactions_received || 0,
          unique_styles: userInsights.favorite_styles?.length || 0,
          most_active_hour: userInsights.peak_creative_hours?.[0] || 12,
          week_over_week_change: userInsights.metrics?.visuals_created_change || 0,
          top_style: userInsights.favorite_styles?.[0] || 'None',
          improvement_tips: userInsights.recommendations?.map(r => r.description || r.title) || []
        });
      }
      setTrendingStyles(trends);
      // Convert recommendations to PersonalRecommendation format
      setRecommendations(recs.map(r => ({
        id: r.title,
        type: r.type === 'try_trending_style' ? 'style' : 
              r.type === 'join_challenge' ? 'challenge' : 
              r.type === 'collaborate' ? 'technique' : 'prompt',
        title: r.title,
        description: r.description || '',
        reason: r.reason || '',
        confidence_score: typeof r.priority === 'number' ? r.priority / 10 : 0.5
      })));
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getChangeIndicator = (change: number) => {
    if (change > 0) return { icon: ArrowUp, color: 'text-green-400', bg: 'bg-green-500/20' };
    if (change < 0) return { icon: ArrowDown, color: 'text-red-400', bg: 'bg-red-500/20' };
    return { icon: Minus, color: 'text-gray-400', bg: 'bg-gray-500/20' };
  };

  const getStreakEmoji = (days: number): string => {
    if (days >= 30) return '🔥👑';
    if (days >= 14) return '🔥🔥';
    if (days >= 7) return '🔥';
    if (days >= 3) return '✨';
    return '🌱';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Creative Insights</h2>
              <p className="text-gray-400 text-sm">Your weekly analytics & trends</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-6">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'trends', label: 'Trends', icon: TrendingUp },
            { id: 'recommendations', label: 'For You', icon: Lightbulb },
            { id: 'achievements', label: 'Achievements', icon: Award }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Streak Card */}
                  {insights?.streaks && (
                    <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl p-6 border border-orange-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl">
                            {getStreakEmoji(insights.streaks.current_streak)}
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-white">
                              {insights.streaks.current_streak} Day Streak!
                            </h3>
                            <p className="text-orange-200/70">
                              Keep creating to maintain your streak
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Best Streak</p>
                          <p className="text-xl font-bold text-orange-400">
                            {insights.streaks.longest_streak} days
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={Zap}
                      label="Generations"
                      value={formatNumber(weeklySummary?.generation_count || 0)}
                      change={weeklySummary?.week_over_week_change || 0}
                      color="yellow"
                    />
                    <StatCard
                      icon={Star}
                      label="Reactions"
                      value={formatNumber(weeklySummary?.total_reactions || 0)}
                      change={0}
                      color="pink"
                    />
                    <StatCard
                      icon={Palette}
                      label="Styles Used"
                      value={weeklySummary?.unique_styles || 0}
                      change={0}
                      color="purple"
                    />
                    <StatCard
                      icon={Clock}
                      label="Peak Hour"
                      value={`${weeklySummary?.most_active_hour || 0}:00`}
                      change={0}
                      color="blue"
                      hideChange
                    />
                  </div>

                  {/* Weekly Summary */}
                  {weeklySummary && (
                    <div className="bg-gray-800/50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-400" />
                        This Week's Highlights
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Top Style */}
                        <div className="bg-gray-900/50 rounded-lg p-4">
                          <p className="text-sm text-gray-400 mb-1">Most Used Style</p>
                          <p className="text-xl font-bold text-white">
                            {weeklySummary.top_style || 'None yet'}
                          </p>
                        </div>
                        
                        {/* Best Performing */}
                        {weeklySummary.best_performing && (
                          <div className="bg-gray-900/50 rounded-lg p-4">
                            <p className="text-sm text-gray-400 mb-1">Best Performing</p>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-10 h-10 rounded-lg bg-cover bg-center"
                                style={{ backgroundImage: `url(${weeklySummary.best_performing.image_url})` }}
                              />
                              <div>
                                <p className="text-white font-medium">
                                  {weeklySummary.best_performing.reactions} reactions
                                </p>
                                <p className="text-xs text-gray-400">
                                  {weeklySummary.best_performing.style}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Improvement Tips */}
                        {weeklySummary.improvement_tips && weeklySummary.improvement_tips.length > 0 && (
                          <div className="md:col-span-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20">
                            <p className="text-sm text-purple-300 mb-2 flex items-center gap-2">
                              <Sparkles className="w-4 h-4" />
                              Tips to Improve
                            </p>
                            <ul className="space-y-1">
                              {weeklySummary.improvement_tips.slice(0, 3).map((tip: string, i: number) => (
                                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                  <span className="text-purple-400">•</span>
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Style Diversity */}
                  {insights && insights.style_diversity && insights.style_diversity.length > 0 && (
                    <div className="bg-gray-800/50 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Palette className="w-5 h-5 text-purple-400" />
                        Your Style Mix
                      </h3>
                      <div className="space-y-3">
                        {insights.style_diversity.slice(0, 5).map((style: any, index: number) => (
                          <div key={style.style} className="flex items-center gap-3">
                            <div className="w-24 text-sm text-gray-300">{style.style}</div>
                            <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                                style={{ width: `${style.percentage}%` }}
                              />
                            </div>
                            <div className="w-12 text-right text-sm text-gray-400">
                              {style.percentage.toFixed(0)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trends Tab */}
              {activeTab === 'trends' && (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    {trendingStyles.map((trend, index) => (
                      <TrendCard key={trend.style} trend={trend} rank={index + 1} />
                    ))}
                  </div>

                  {trendingStyles.length === 0 && (
                    <div className="text-center py-12">
                      <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No trending styles yet</p>
                      <p className="text-sm text-gray-500">Check back later for community trends</p>
                    </div>
                  )}
                </div>
              )}

              {/* Recommendations Tab */}
              {activeTab === 'recommendations' && (
                <div className="space-y-4">
                  {recommendations.map((rec) => (
                    <RecommendationCard 
                      key={rec.id} 
                      recommendation={rec}
                      onTry={() => {
                        // Handle trying recommendation - just log for now
                        console.log('Applying recommendation:', rec.id);
                      }}
                      onDismiss={() => {
                        // Remove from local state
                        setRecommendations(prev => prev.filter(r => r.id !== rec.id));
                      }}
                    />
                  ))}

                  {recommendations.length === 0 && (
                    <div className="text-center py-12">
                      <Lightbulb className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No recommendations yet</p>
                      <p className="text-sm text-gray-500">
                        Create more to get personalized suggestions
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Achievements Tab */}
              {activeTab === 'achievements' && insights?.achievements && (
                <div className="space-y-6">
                  {/* Achievement Categories */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {insights.achievements.map((achievement: any) => (
                      <AchievementCard key={achievement.id} achievement={achievement} />
                    ))}
                  </div>

                  {insights.achievements.length === 0 && (
                    <div className="text-center py-12">
                      <Award className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No achievements yet</p>
                      <p className="text-sm text-gray-500">
                        Keep creating to unlock achievements
                      </p>
                    </div>
                  )}

                  {/* Level Progress */}
                  {insights.level && (
                    <div className="bg-gray-800/50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          <Crown className="w-5 h-5 text-yellow-400" />
                          Creator Level
                        </h3>
                        <span className="text-2xl font-bold text-yellow-400">
                          Lvl {insights.level}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
                          style={{ width: `${(insights.xp_progress || 0) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-400 mt-2">
                        {Math.round((insights.xp_progress || 0) * 100)}% to next level
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-components
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  change: number;
  color: 'yellow' | 'pink' | 'purple' | 'blue';
  hideChange?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, change, color, hideChange }) => {
  const colorStyles = {
    yellow: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30 text-yellow-400',
    pink: 'from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400',
    purple: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-400',
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400'
  };

  const indicator = getChangeIndicator(change);

  return (
    <div className={`bg-gradient-to-br ${colorStyles[color]} rounded-xl p-4 border`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5" />
        {!hideChange && change !== 0 && (
          <div className={`flex items-center gap-1 ${indicator.color} text-xs`}>
            <indicator.icon className="w-3 h-3" />
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
};

const getChangeIndicator = (change: number) => {
  if (change > 0) return { icon: ArrowUp, color: 'text-green-400' };
  if (change < 0) return { icon: ArrowDown, color: 'text-red-400' };
  return { icon: Minus, color: 'text-gray-400' };
};

interface TrendCardProps {
  trend: TrendingStyle;
  rank: number;
}

const TrendCard: React.FC<TrendCardProps> = ({ trend, rank }) => {
  const rankColors = ['text-yellow-400', 'text-gray-300', 'text-orange-400'];
  const rankBgs = ['bg-yellow-500/20', 'bg-gray-500/20', 'bg-orange-500/20'];

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors">
      <div className="flex items-start gap-4">
        <div className={`w-8 h-8 rounded-lg ${rankBgs[rank - 1] || 'bg-gray-600'} flex items-center justify-center`}>
          <span className={`font-bold ${rankColors[rank - 1] || 'text-gray-400'}`}>
            #{rank}
          </span>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-white">{trend.style}</h4>
          <p className="text-sm text-gray-400">
            {trend.usage_count} uses this week
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className={`flex items-center gap-1 text-xs ${
              trend.trend_direction === 'rising' ? 'text-green-400' :
              trend.trend_direction === 'falling' ? 'text-red-400' : 'text-gray-400'
            }`}>
              {trend.trend_direction === 'rising' && <TrendingUp className="w-3 h-3" />}
              {trend.trend_direction === 'falling' && <TrendingUp className="w-3 h-3 rotate-180" />}
              {trend.growth_percentage > 0 ? '+' : ''}{trend.growth_percentage.toFixed(0)}%
            </div>
            {trend.sample_images && trend.sample_images.length > 0 && (
              <div className="flex -space-x-2">
                {trend.sample_images.slice(0, 3).map((img: string, i: number) => (
                  <div 
                    key={i}
                    className="w-6 h-6 rounded-full bg-cover bg-center border-2 border-gray-800"
                    style={{ backgroundImage: `url(${img})` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface RecommendationCardProps {
  recommendation: PersonalRecommendation;
  onTry: () => void;
  onDismiss: () => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ 
  recommendation, 
  onTry, 
  onDismiss 
}) => {
  const typeIcons: Record<string, React.ElementType> = {
    style: Palette,
    prompt: Sparkles,
    technique: Target,
    challenge: Award
  };

  const Icon = typeIcons[recommendation.type] || Lightbulb;

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-white">{recommendation.title}</h4>
              <p className="text-sm text-gray-400 mt-1">{recommendation.description}</p>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={onTry}
              className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              Try it
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500">
              {Math.round(recommendation.confidence_score * 100)}% match
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AchievementCardProps {
  achievement: {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlocked: boolean;
    unlocked_at?: string;
    progress?: number;
    target?: number;
  };
}

const AchievementCard: React.FC<AchievementCardProps> = ({ achievement }) => {
  return (
    <div className={`rounded-xl p-4 border transition-all ${
      achievement.unlocked 
        ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30' 
        : 'bg-gray-800/30 border-gray-700/30 opacity-60'
    }`}>
      <div className="text-3xl mb-2">{achievement.icon}</div>
      <h4 className={`font-semibold ${achievement.unlocked ? 'text-white' : 'text-gray-400'}`}>
        {achievement.name}
      </h4>
      <p className="text-xs text-gray-400 mt-1">{achievement.description}</p>
      
      {!achievement.unlocked && achievement.progress !== undefined && achievement.target && (
        <div className="mt-3">
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gray-500 rounded-full"
              style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {achievement.progress} / {achievement.target}
          </p>
        </div>
      )}
      
      {achievement.unlocked && achievement.unlocked_at && (
        <p className="text-xs text-yellow-400/70 mt-2">
          Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

export default InsightsDashboard;
