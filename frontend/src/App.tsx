
import './App.css';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GroupsPage from './pages/GroupsPage';
import { useEffect, useState } from 'react';
import { createRealtimeSocket } from './realtime/socket';
import api from './api/axios';

function HomePage() {
  const { user, accessToken, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [summaryVersion, setSummaryVersion] = useState(0);
  
const [totalOwedPaise, setTotalOwedPaise] = useState(0);
const [totalOwePaise, setTotalOwePaise] = useState(0);
const [groupCount, setGroupCount] = useState(0);
const [summaryLoading, setSummaryLoading] = useState(false);

useEffect(() => {
  if (!isAuthenticated || isLoading || !user) return;
   const currentUserId = user.id;

  let cancelled = false;

  async function loadSummary() {
    setSummaryLoading(true);

    try {
      const groupsResponse = await api.get('/groups');
      const groups = groupsResponse.data;

      if (!Array.isArray(groups)) {
        throw new Error('Unexpected groups response');
      }

      const results = await Promise.all(
        groups.map(async (group: { id: string }) => {
          const response = await api.get(
            `/groups/${group.id}/balances`,
          );
          return response.data;
        }),
      );

      let owed = 0;
      let owe = 0;

      for (const balances of results) {
        if (!Array.isArray(balances)) continue;

        for (const balance of balances) {
           if (balance.userId !== currentUserId) continue;

          const paise =
            typeof balance.balancePaise === 'number'
              ? balance.balancePaise
              : Math.round((balance.balanceRupees ?? 0) * 100);

          if (paise > 0) owed += paise;
          if (paise < 0) owe += Math.abs(paise);
        }
      }

      if (!cancelled) {
        setTotalOwedPaise(owed);
        setTotalOwePaise(owe);
        setGroupCount(groups.length);
      }
    } catch (error) {
      console.error('Could not load dashboard summary:', error);
    } finally {
      if (!cancelled) setSummaryLoading(false);
    }
  }

  void loadSummary();

  return () => {
    cancelled = true;
  };
}, [isAuthenticated, isLoading, user, summaryVersion]);

useEffect(() => {
  if (!accessToken || !isAuthenticated || isLoading) return;

  const socket = createRealtimeSocket(accessToken);

  const refreshSummary = () => {
    setSummaryVersion((version) => version + 1);
  };

  socket.on('connect', () => {
    // Refresh once the socket reconnects.
    refreshSummary();
  });

  socket.on('group:balance-updated', refreshSummary);
  socket.on('group:expense-created', refreshSummary);
  socket.on('group:expense-updated', refreshSummary);
  socket.on('group:expense-deleted', refreshSummary);
  socket.on('group:settlement-created', refreshSummary);

  socket.connect();

  return () => {
    socket.off('group:balance-updated', refreshSummary);
    socket.off('group:expense-created', refreshSummary);
    socket.off('group:expense-updated', refreshSummary);
    socket.off('group:expense-deleted', refreshSummary);
    socket.off('group:settlement-created', refreshSummary);
    socket.disconnect();
  };
}, [accessToken, isAuthenticated, isLoading]);



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
          <a href="#activity">Activity</a>
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
          </div>
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
    </Routes>
  );
}

export default App;
