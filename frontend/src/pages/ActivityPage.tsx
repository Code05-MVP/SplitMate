
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

interface Group {
  id: string;
  name: string;
}

interface ActivityRecord {
  id: string;
  action: string;
  details: {
    description?: string;
    [key: string]: unknown;
  } | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
}

 function formatAction(action: string): string {
  const labels: Record<string, string> = {
    GROUP_CREATED: 'Group created',
    EXPENSE_CREATED: 'Expense added',
    EXPENSE_UPDATED: 'Expense updated',
    EXPENSE_DELETED: 'Expense deleted',
    MEMBER_ADDED: 'Member added',
    MEMBER_REMOVED: 'Member removed',
    SETTLEMENT_CREATED: 'Settlement recorded',
  };

  return labels[action] ??
    action.toLowerCase().replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}

function getActionIcon(action: string): string {
  if (action.includes('EXPENSE')) return '₹';
  if (action.includes('SETTLEMENT')) return '↔';
  if (action.includes('MEMBER')) return '+';
  return 'G';
}

function ActivityPage() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useAuth();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);


  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !accessToken) {
      setGroups([]);
      setSelectedGroupId('');
      setActivities([]);
      setLoadingGroups(false);
      return;
    }

    let cancelled = false;

    async function loadGroups() {
      setLoadingGroups(true);
      setError('');

      try {
        const response = await api.get<Group[]>('/groups');

        if (cancelled) return;

        setGroups(response.data);
        setSelectedGroupId((current) =>
          current && response.data.some((group) => group.id === current)
            ? current
            : response.data[0]?.id ?? '',
        );
      } catch {
        if (!cancelled) {
          setError('Could not load your groups. Please try again.');
        }
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    }

    void loadGroups();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, accessToken]);

  useEffect(() => {
    if (!selectedGroupId || !isAuthenticated || !accessToken) {
      setActivities([]);
      return;
    }

    let cancelled = false;

    async function loadActivity() {
      setLoadingActivities(true);
      setError('');

      try {
        const response = await api.get<ActivityRecord[]>(
          `/groups/${selectedGroupId}/activity`,
          { params: { page: 1, limit: 20 } },
        );

        if (!cancelled) setActivities(response.data);
      } catch {
        if (!cancelled) {
          setActivities([]);
          setError('Could not load activity for this group.');
        }
      } finally {
        if (!cancelled) setLoadingActivities(false);
      }
    }

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, isAuthenticated, accessToken, refreshVersion]);

  if (authLoading || loadingGroups) {
    return (
      <main className="activity-page">
        <p>Loading your activity...</p>
      </main>
    );
  }

  if (!isAuthenticated || !accessToken) {
    return (
      <main className="activity-page">
        <Link to="/">← Back to home</Link>
        <h1>Activity</h1>
        <p>Please log in to view your group activity.</p>
        <Link to="/login">Go to login</Link>
      </main>
    );
  }

  const selectedGroup = groups.find((group) => group.id === selectedGroupId);

  return (
    <main className="activity-page">
      <header className="activity-header">
        <div className="activity-brand-icon" aria-hidden="true">S</div>
        <div className="activity-header-copy">
          <p className="activity-eyebrow">YOUR WORKSPACE</p>
          <h1>Activity</h1>
          <p>Stay up to date with everything happening in your groups.</p>
        </div>
        <Link className="activity-back-link" to="/">
          ← Back to home
        </Link>
      </header>

      <section className="activity-group-panel">
        <div className="activity-group-icon" aria-hidden="true">G</div>
        <div className="activity-group-info">
          <span className="activity-panel-label">SELECTED GROUP</span>
          <h2>{selectedGroup?.name ?? 'Your groups'}</h2>
          <p>Shared expenses and group updates</p>
        </div>

        {groups.length > 0 && (
          <label className="activity-group-select">
            <span>Choose a group</span>
            <select
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className="activity-stats" aria-label="Activity summary">
        <article className="activity-stat-card">
          <span className="activity-stat-icon" aria-hidden="true">↗</span>
          <span className="activity-stat-label">Recent events</span>
          <strong>{loadingActivities ? '—' : activities.length}</strong>
          <span className="activity-stat-caption">
            {activities.length === 20 ? 'Latest 20 loaded' : 'Events loaded'}
          </span>
        </article>

        <article className="activity-stat-card">
          <span className="activity-stat-icon" aria-hidden="true">◷</span>
          <span className="activity-stat-label">Activity feed</span>
          <strong>Latest first</strong>
          <span className="activity-stat-caption">Sorted by event date</span>
        </article>
      </section>

      <section className="activity-feed-section">
        <div className="activity-feed-heading">
          <div>
            <p className="activity-eyebrow">GROUP UPDATES</p>
            <h2>Recent activity</h2>
            <p>See who did what and when.</p>
          </div>
          <button
               className="activity-refresh-button"
               type="button"
               disabled={loadingActivities || !selectedGroupId}
                onClick={() => setRefreshVersion((version) => version + 1)}
               title="Refresh activity"
             >
              ↻ Refresh
         </button>
        </div>

        {error && <p className="activity-error" role="alert">{error}</p>}

        {!error && groups.length === 0 && (
          <div className="activity-empty-state">
            <div className="activity-empty-icon">G</div>
            <h3>No groups yet</h3>
            <p>Create or join a group to see its activity here.</p>
            <Link to="/groups">Explore groups</Link>
          </div>
        )}

        {loadingActivities && (
          <div className="activity-empty-state">
            <p>Loading recent activity...</p>
          </div>
        )}

        {!loadingActivities && !error && selectedGroupId && activities.length === 0 && (
          <div className="activity-empty-state">
            <div className="activity-empty-icon">✓</div>
            <h3>You're all caught up</h3>
            <p>New updates for this group will appear here.</p>
          </div>
        )}

        {!loadingActivities && activities.length > 0 && (
          <div className="activity-timeline">
            {activities.map((activity) => (
              <article className="activity-timeline-item" key={activity.id}>
                <div className="activity-timeline-marker" aria-hidden="true">
                  {getActionIcon(activity.action)}
                </div>

                <div className="activity-timeline-card">
                  <div className="activity-timeline-top">
                    <div className="activity-actor">
                      <span className="activity-avatar" aria-hidden="true">
                        {(activity.actor?.name ?? 'U').charAt(0).toUpperCase()}
                      </span>
                      <strong>{activity.actor?.name ?? 'Former member'}</strong>
                    </div>
                    <span className="activity-action-badge">
                      {formatAction(activity.action)}
                    </span>
                  </div>

                  <p className="activity-description">
                    {activity.details?.description ?? 'An activity was recorded.'}
                  </p>

                  <time dateTime={activity.createdAt}>
                    {new Date(activity.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default ActivityPage;
