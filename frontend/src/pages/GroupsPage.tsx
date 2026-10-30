
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

interface GroupMember {
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    name: string;
    email: string;
  };
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  ownerId: string;
  members: GroupMember[];
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (error as {
      response?: { data?: { message?: string | string[] } };
    }).response;

    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }

  return fallback;
}

export default function GroupsPage() {
  const { accessToken } = useAuth();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchGroups = useCallback(async () => {
    if (!accessToken) {
      setGroups([]);
      setError('Please log in to view your groups.');
      setLoading(false);
      return;
    }

    try {
      const response = await api.get<Group[]>('/groups');
      setGroups(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your groups.'));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchGroups();
  }, [fetchGroups]);

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    const name = groupName.trim();
    const groupDescription = description.trim();

    if (name.length < 2 || name.length > 100) {
      setFormError('Group name must be between 2 and 100 characters.');
      return;
    }

    if (groupDescription.length > 500) {
      setFormError('Description cannot exceed 500 characters.');
      return;
    }

    setCreating(true);

    try {
      await api.post('/groups', {
        name,
        description: groupDescription || undefined,
      });

      setGroupName('');
      setDescription('');
      setShowForm(false);
      setSuccess('Group created successfully.');
      await fetchGroups();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create the group.'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="groups-page">

<header className="groups-page-header">
  <div>
    <Link to="/" className="groups-back-link">
      ← Back to Dashboard
    </Link>
    <h1>My Groups</h1>
    <p>Manage shared expenses with friends and family.</p>
  </div>

  <button
    type="button"
    onClick={() => {
      setShowForm((current) => !current);
      setFormError('');
    }}
  >
    {showForm ? 'Cancel' : '+ Create Group'}
  </button>
</header>


      {success && (
        <p className="groups-success" role="status">{success}</p>
      )}

      {showForm && (
        <form className="create-group-form" onSubmit={handleCreateGroup}>
          <h2>Create a group</h2>

          <label htmlFor="group-name">Group name</label>
          <input
            id="group-name"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="e.g. Goa Trip"
            minLength={2}
            maxLength={100}
            required
          />

          <label htmlFor="group-description">Description (optional)</label>
          <textarea
            id="group-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this group for?"
            maxLength={500}
            rows={3}
          />

          {formError && (
            <p className="groups-error" role="alert">{formError}</p>
          )}

          <button type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      )}

      {error && (
        <p className="groups-error" role="alert">{error}</p>
      )}

      {loading ? (
        <p>Loading your groups...</p>
      ) : groups.length === 0 ? (
        <section className="groups-empty">
          <h2>No groups yet</h2>
          <p>Create your first group to start splitting expenses.</p>
          <button type="button" onClick={() => setShowForm(true)}>
            Create your first group
          </button>
        </section>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => (
            <article className="group-card compact-group-card" key={group.id}>
              <div className="group-card-icon" aria-hidden="true">♧</div>

              <h2>{group.name}</h2>

              <p className="group-description">
                {group.description || 'No description provided.'}
              </p>

              <div className="group-card-details">
                <span>
                  {group.members.length}{' '}
                  {group.members.length === 1 ? 'member' : 'members'}
                </span>
                <span>
                  Created {new Date(group.createdAt).toLocaleDateString()}
                </span>
              </div>

              <Link
                to={`/groups/${group.id}`}
                className="view-group-button"
              >
                View Group →
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
