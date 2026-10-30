
import './App.css';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GroupsPage from './pages/GroupsPage';
import { useEffect, useState } from 'react';
import { createRealtimeSocket } from './realtime/socket';
import api from './api/axios';
import ActivityPage from './pages/ActivityPage';
import GroupDetailsPage from './pages/GroupDetailsPage';
import { readAccessToken } from './api/tokenHandler';


type DashboardGroup = {
  id: string;
  name: string;
};

type GroupBalance = {
  userId: string;
  balancePaise?: number;
  balanceRupees?: number;
};
interface DashboardActivity {
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
  groupId: string;
  groupName: string;
}

function formatDashboardAction(action: string): string {
  const labels: Record<string, string> = {
    GROUP_CREATED: 'Group created',
    EXPENSE_CREATED: 'Expense added',
    EXPENSE_UPDATED: 'Expense updated',
    EXPENSE_DELETED: 'Expense deleted',
    MEMBER_ADDED: 'Member added',
    MEMBER_REMOVED: 'Member removed',
    SETTLEMENT_CREATED: 'Settlement recorded',
  };

  return (
    labels[action] ??
    action.toLowerCase().replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())
  );
}
function HomePage() {
  const {
  user,
  accessToken,
  isAuthenticated,
  isLoading,
  logout,
  refreshAccessToken,
} = useAuth();

  const navigate = useNavigate();

  const [summaryVersion, setSummaryVersion] = useState(0);
  const [totalOwedPaise, setTotalOwedPaise] = useState(0);
  const [totalOwePaise, setTotalOwePaise] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [largestDebtGroup, setLargestDebtGroup] = useState<{
    id: string;
    name: string;
    amountPaise: number;
  } | null>(null);

  const [summaryError, setSummaryError] = useState('');
  const [recentActivities, setRecentActivities] = useState<
  DashboardActivity[]
>([]);
const [activityLoading, setActivityLoading] = useState(false);
const [activityError, setActivityError] = useState('');
const [activityVersion, setActivityVersion] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || isLoading || !user) return;

    const currentUserId = user.id;
    let cancelled = false;

    async function loadSummary() {
      setSummaryLoading(true);
      setSummaryError('');

      try {
        const groupsResponse = await api.get('/groups');
        const groups: DashboardGroup[] = groupsResponse.data;

        if (!Array.isArray(groups)) {
          throw new Error('Unexpected groups response');
        }

        const results: GroupBalance[][] = await Promise.all(
          groups.map(async (group) => {
            const response = await api.get(
              `/groups/${group.id}/balances`,
            );
            return response.data;
          }),
        );

        let owed = 0;
        let owe = 0;

        let largestDebt: {
          id: string;
          name: string;
          amountPaise: number;
        } | null = null;

        for (let i = 0; i < results.length; i++) {
          const balances = results[i];
          const group = groups[i];

          if (!Array.isArray(balances)) continue;

          const myBalance = balances.find(
            (balance) => balance.userId === currentUserId,
          );

          if (!myBalance) continue;

          const paise =
            typeof myBalance.balancePaise === 'number'
              ? myBalance.balancePaise
              : Math.round((myBalance.balanceRupees ?? 0) * 100);

          if (paise > 0) {
            owed += paise;
          }

          if (paise < 0) {
            const amountOwed = Math.abs(paise);
            owe += amountOwed;

            if (
              !largestDebt ||
              amountOwed > largestDebt.amountPaise
            ) {
              largestDebt = {
                id: group.id,
                name: group.name,
                amountPaise: amountOwed,
              };
            }
          }
        }

        if (!cancelled) {
          setTotalOwedPaise(owed);
          setTotalOwePaise(owe);
          setGroupCount(groups.length);
          setLargestDebtGroup(largestDebt);
          setSummaryError('');
        }
      } catch (error) {
        console.error('Could not load dashboard summary:', error);

        if (!cancelled) {
          setSummaryError(
            'Could not load your dashboard. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, user, summaryVersion]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !accessToken || !user) {
      setRecentActivities([]);
      setActivityLoading(false);
      setActivityError('');
      return;
    }

    let cancelled = false;

    async function loadRecentActivities() {
      setActivityLoading(true);
      setActivityError('');

      try {
        const groupsResponse = await api.get<
          { id: string; name: string }[]
        >('/groups');

        const groups = groupsResponse.data;

        if (!Array.isArray(groups)) {
          throw new Error('Unexpected groups response');
        }

        const activityResults = await Promise.all(
          groups.map(async (group) => {
            const response = await api.get<
              Omit<DashboardActivity, 'groupId' | 'groupName'>[]
            >(`/groups/${group.id}/activity`, {
              params: { page: 1, limit: 20 },
            });

            return response.data.map((activity) => ({
              ...activity,
              groupId: group.id,
              groupName: group.name,
            }));
          }),
        );

        const combinedActivities = activityResults
          .flat()
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime(),
          )
          .slice(0, 5);

        if (!cancelled) {
          setRecentActivities(combinedActivities);
        }
      } catch (error) {
        console.error('Could not load recent activity:', error);

        if (!cancelled) {
          setRecentActivities([]);
          setActivityError(
            'Could not load recent activity. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    }

    void loadRecentActivities();

    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, accessToken, user, activityVersion]);




useEffect(() => {
  if (!accessToken || !isAuthenticated || isLoading) return;

  const socket = createRealtimeSocket(readAccessToken);
  let groupIds: string[] = [];

  const refreshSummary = () => {
    setSummaryVersion((version) => version + 1);
  };

  const refreshActivity = () => {
    setActivityVersion((version) => version + 1);
  };

  const joinGroups = () => {
    groupIds.forEach((groupId) => {
      console.log('[Dashboard Socket] Joining group:', groupId);
      socket.emit('group:join', { groupId });
    });
  };

  const handleConnect = () => {
    console.log('[Dashboard Socket] Connected:', socket.id);
    joinGroups();
    refreshSummary();
    refreshActivity();
  };

  const handleDisconnect = (reason: string) => {
    console.log('[Dashboard Socket] Disconnected:', reason);

    if (reason === 'io server disconnect') {
      void refreshAccessToken()
        .then(() => {
          console.log('[Dashboard Socket] Access token refreshed.');
        })
        .catch((error) => {
          console.error('[Dashboard Socket] Token refresh failed:', error);
          window.dispatchEvent(
            new Event('splitmate:session-expired'),
          );
        });
    }
  };

  socket.on('connect', handleConnect);
  socket.on('disconnect', handleDisconnect);

  socket.on('group:balance-updated', refreshSummary);
  socket.on('group:expense-created', refreshSummary);
  socket.on('group:expense-updated', refreshSummary);
  socket.on('group:expense-deleted', refreshSummary);
  socket.on('group:settlement-created', refreshSummary);

  socket.on('group:activity-updated', refreshSummary);
  socket.on('group:activity-updated', refreshActivity);

  socket.connect();

  async function loadGroupsAndJoin() {
    try {
      const response = await api.get<DashboardGroup[]>('/groups');

      groupIds = response.data.map((group) => group.id);

      console.log('[Dashboard Socket] Groups loaded:', groupIds);

      if (socket.connected) {
        joinGroups();
      }
    } catch (error) {
      console.error('[Dashboard Socket] Could not load groups:', error);
    }
  }

  void loadGroupsAndJoin();

  return () => {
    socket.off('connect', handleConnect);
    socket.off('disconnect', handleDisconnect);

    socket.off('group:balance-updated', refreshSummary);
    socket.off('group:expense-created', refreshSummary);
    socket.off('group:expense-updated', refreshSummary);
    socket.off('group:expense-deleted', refreshSummary);
    socket.off('group:settlement-created', refreshSummary);

    socket.off('group:activity-updated', refreshSummary);
    socket.off('group:activity-updated', refreshActivity);

    socket.disconnect();
  };
}, [
  accessToken,
  isAuthenticated,
  isLoading,
  refreshAccessToken,
]);



  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app">
      <header className="navbar">
        <Link className="brand" to="/">
          <span className="brand-icon">S</span>
          SplitMate
        </Link>

        <nav>
          <a href="#dashboard">Dashboard</a>
          <Link to="/groups">My Groups</Link>
          <Link to="/activity">Activity</Link>
        </nav>

        {isLoading ? (
          <span>Checking session...</span>
        ) : isAuthenticated ? (
          <div className="auth-nav">
            <span>Hi, {user?.name}</span>
            <button
              className="login-button"
              type="button"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        ) : (
          <Link className="login-button" to="/login">
            Log in
          </Link>
        )}
      </header>

      <main id="dashboard">
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow">
              SHARE EXPENSES. STAY FRIENDS.
            </span>

            <h1>
              Split expenses.
              <br />
              <span>Not friendships.</span>
            </h1>

            <p>
              Keep track of shared expenses, see who owes what,
              and settle up with your friends—all in one place.
            </p>

            <div className="hero-actions">
              {isAuthenticated ? (
                <Link className="home-primary-button" to="/groups">
                  Explore groups →
                </Link>
              ) : (
                <Link className="home-primary-button" to="/register">
                  Get started →
                </Link>
              )}

              <a href="#features">Explore features ↓</a>
            </div>

            <div className="hero-note">
              <span className="status-dot" />
              Simple, transparent expense tracking
            </div>
          </div>

          <div className="preview-card">
            <div className="preview-header">
              <div>
                <span className="muted">YOUR OVERVIEW</span>
                <h2>Expense summary</h2>
              </div>

              <span className="avatar">
                {user?.name?.charAt(0).toUpperCase() || 'S'}
              </span>
            </div>

            {summaryError && (
              <div className="groups-error" role="alert">
                <p>{summaryError}</p>
                <button
                  type="button"
                  onClick={() =>
                    setSummaryVersion((version) => version + 1)
                  }
                >
                  Try again
                </button>
              </div>
            )}

            <div className="balance-card">
              <span>Total net balance</span>
              <strong>
                {summaryLoading
                  ? 'Loading...'
                  : `₹${((totalOwedPaise - totalOwePaise) / 100).toFixed(2)}`}
              </strong>
              <small>
                {isAuthenticated
                  ? 'Your combined balance across all groups'
                  : 'Sign in to view your balances'}
              </small>
            </div>

            <div className="summary-row">
              <div>
                <span className="muted">YOU OWE</span>
                <strong>
                  {summaryLoading
                    ? 'Loading...'
                    : `₹${(totalOwePaise / 100).toFixed(2)}`}
                </strong>
              </div>

              <div>
                <span className="muted">YOU ARE OWED</span>
                <strong>
                  {summaryLoading
                    ? 'Loading...'
                    : `₹${(totalOwedPaise / 100).toFixed(2)}`}
                </strong>
              </div>
            </div>

            <div className="empty-groups">
              <strong>
                {isAuthenticated
                  ? groupCount > 0
                    ? `You're part of ${groupCount} group${groupCount === 1 ? '' : 's'}`
                    : 'Ready to create your first group?'
                  : 'Your groups will appear here'}
              </strong>

              <p>
                {isAuthenticated
                  ? groupCount > 0
                    ? 'View your groups and manage shared expenses.'
                    : 'Start splitting expenses with your friends.'
                  : 'Create a group to start splitting expenses.'}
              </p>
            </div>

            <div className="empty-groups">
              <strong>Group where you owe the most</strong>

              {summaryLoading ? (
                <p>Calculating your largest debt...</p>
              ) : largestDebtGroup ? (
                <>
                  <p>{largestDebtGroup.name}</p>
                  <strong>
                    ₹{(largestDebtGroup.amountPaise / 100).toFixed(2)}
                  </strong>
                  <p>
                    <Link to={`/groups/${largestDebtGroup.id}`}>
                      View group →
                    </Link>
                  </p>
                </>
              ) : (
                <p>
                  {isAuthenticated
                    ? 'You currently have no outstanding debt in your groups.'
                    : 'Sign in to view your group balances.'}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="features dashboard-recent-activity">
          <span className="eyebrow">YOUR LATEST UPDATES</span>
          <h2>Recent activity</h2>
          <p className="section-description">
            Your latest expense and group updates across all your groups.
          </p>

          {activityLoading && (
            <p role="status">Loading recent activity...</p>
          )}

          {!activityLoading && activityError && (
            <div className="groups-error" role="alert">
              <p>{activityError}</p>
              <button
                type="button"
                onClick={() => {
                  setRecentActivities([]);
                  setActivityError('');
                  setActivityLoading(true);
                  window.location.reload();
                }}
              >
                Reload dashboard
              </button>
            </div>
          )}

          {!activityLoading &&
            !activityError &&
            recentActivities.length === 0 && (
              <div className="empty-groups">
                <strong>No recent activity yet</strong>
                <p>
                  Add an expense or record a settlement to see updates here.
                </p>
              </div>
            )}

          {!activityLoading &&
            !activityError &&
            recentActivities.length > 0 && (
              <div className="activity-timeline">
                {recentActivities.map((activity) => (
                  <article
                    className="activity-timeline-item"
                    key={`${activity.groupId}-${activity.id}`}
                  >
                    <div
                      className="activity-timeline-marker"
                      aria-hidden="true"
                    >
                      {activity.action.includes('SETTLEMENT')
                        ? '↔'
                        : activity.action.includes('EXPENSE')
                          ? '₹'
                          : 'G'}
                    </div>

                    <div className="activity-timeline-card">
                      <strong>
                        {activity.actor?.name ?? 'Former member'}
                      </strong>

                      <span className="activity-action-badge">
                        {formatDashboardAction(activity.action)}
                      </span>

                      <p className="activity-description">
                        {activity.details?.description ??
                          'An activity was recorded.'}
                      </p>

                      <p>
                        Group:{' '}
                        <Link to={`/groups/${activity.groupId}`}>
                          {activity.groupName}
                        </Link>
                      </p>

                      <time dateTime={activity.createdAt}>
                        {new Date(activity.createdAt).toLocaleString(
                          undefined,
                          {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          },
                        )}
                      </time>
                    </div>
                  </article>
                ))}
              </div>
            )}

          <p>
            <Link to="/activity">View all activity →</Link>
          </p>
        </section>


        <section id="features" className="features">
          <span className="eyebrow">
            MADE FOR EVERYDAY SHARING
          </span>

          <h2>Less calculating. More living.</h2>

          <p className="section-description">
            Whether it is a trip, a flat, or dinner with friends,
            SplitMate helps everyone stay on the same page.
          </p>

          <div className="feature-grid" id="groups">
            <article className="feature-card">
              <span className="feature-icon">♧</span>
              <h3>Organize in groups</h3>
              <p>
                Create groups for trips, roommates, or friends and keep
                every shared expense together.
              </p>
            </article>

            <article className="feature-card">
              <span className="feature-icon">₹</span>
              <h3>Split fairly</h3>
              <p>
                Divide costs equally or enter custom shares with precise
                paise-level calculations.
              </p>
            </article>

            <article className="feature-card">
              <span className="feature-icon">↗</span>
              <h3>Settle with clarity</h3>
              <p>
                Understand who owes whom and keep track of settlements
                in one place.
              </p>
            </article>
          </div>
        </section>

        <section id="activity" className="bottom-cta">
          <div>
            <h2>Ready to make splitting simple?</h2>
            <p>Your next shared expense can be easier to manage.</p>
          </div>

          {isAuthenticated ? (
            <Link className="home-primary-button" to="/groups">
              Explore groups →
            </Link>
          ) : (
            <Link className="home-primary-button" to="/register">
              Get started →
            </Link>
          )}
        </section>
      </main>

      <footer>
        <Link className="brand footer-brand" to="/">
          SplitMate
        </Link>

        <span>Shared expenses, made simple.</span>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/groups" element={<GroupsPage />} />
      <Route path="/groups/:groupId" element={<GroupDetailsPage />} />
      <Route path="/activity" element={<ActivityPage />} />
    </Routes>
  );
}

export default App;
