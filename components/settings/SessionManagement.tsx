import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Monitor, 
  Clock, 
  MapPin, 
  LogOut,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

interface SessionManagementProps {
  onShowSuccess: (message: string) => void;
}

const SessionManagement: React.FC<SessionManagementProps> = ({ onShowSuccess }) => {
  const { user, signOut } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    // In a real implementation, this would fetch active sessions from the backend
    // For now, we'll show the current session
    const currentSession: Session = {
      id: 'current',
      device: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'Mobile Device' : 'Desktop',
      browser: getBrowserName(),
      location: 'Current location', // Would use IP geolocation in production
      lastActive: 'Now',
      isCurrent: true,
    };

    setSessions([currentSession]);
  };

  const getBrowserName = (): string => {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown Browser';
  };

  const handleLogoutSession = async (sessionId: string) => {
    setIsLoading(true);
    try {
      if (sessionId === 'current') {
        await signOut();
        window.location.href = '/';
      } else {
        // Would revoke specific session in production
        onShowSuccess('Session ended successfully');
        setSessions(sessions.filter(s => s.id !== sessionId));
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to end session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm('This will sign you out from all devices. Continue?')) return;

    setIsLoading(true);
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout all error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Active Sessions
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Manage devices and browsers where you're currently signed in
        </p>

        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white border border-peach-soft rounded-xl p-3 md:p-4 hover:border-coral-burst/50 hover:shadow-soft-sm transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 md:gap-4">
                <div className="flex items-start gap-2 md:gap-3 flex-1">
                  <div className="mt-0.5 md:mt-1">
                    {session.device.includes('Mobile') ? (
                      <Smartphone className="w-5 h-5 text-coral-burst" />
                    ) : (
                      <Monitor className="w-5 h-5 text-coral-burst" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-charcoal-soft text-sm md:text-base">{session.device}</h4>
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs md:text-sm text-cocoa-light">
                      <div className="flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5" />
                        <span>{session.browser}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{session.lastActive}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate">{session.location}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleLogoutSession(session.id)}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 md:py-2 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 touch-manipulation"
                >
                  <LogOut className="w-4 h-4" />
                  <span>End Session</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* Logout All Devices */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Sign Out Everywhere
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          End all active sessions on all devices
        </p>

        <button
          onClick={handleLogoutAll}
          disabled={isLoading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-gray-300 text-white font-bold py-3.5 md:py-3 px-6 rounded-xl transition-colors touch-manipulation"
        >
          <LogOut className="w-5 h-5" />
          {isLoading ? 'Signing Out...' : 'Sign Out All Devices'}
        </button>
      </div>

      {/* Security Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-blue-900 mb-1">Security Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Sign out from devices you don't recognize</li>
              <li>• Use a strong, unique password</li>
              <li>• Enable two-factor authentication</li>
              <li>• Review sessions regularly</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Account Activity */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-yellow-900 mb-1">Suspicious Activity?</h4>
            <p className="text-sm text-yellow-800 mb-2">
              If you notice any unfamiliar sessions or devices, end those sessions immediately and change your password.
            </p>
            <button className="text-sm font-bold text-yellow-900 hover:text-yellow-700 underline">
              Report Security Issue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionManagement;
