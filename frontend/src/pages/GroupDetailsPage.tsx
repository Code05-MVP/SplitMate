
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import GroupBalances from '../components/GroupBalances';
import GroupExpenses from '../components/GroupExpenses';

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

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (
      error as {
        response?: {
          data?: { message?: string | string[] };
        };
      }
    ).response;

    const message = response?.data?.message;

    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }

  return fallback;
}

function GroupDetailsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
const [loadingActivities, setLoadingActivities] = useState(false);
const [activityError, setActivityError] = useState('');

  const [memberEmail, setMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [memberSuccess, setMemberSuccess] = useState('');
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const [deletingGroup, setDeletingGroup] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadGroup = useCallback(async () => {
    if (!accessToken || !groupId) {
      setGroup(null);
      setError('Unable to load this group. Please log in and try again.');
      setLoading(false);
      return;
    }

    try {
      const response = await api.get<Group[]>('/groups');

      const selectedGroup = Array.isArray(response.data)
        ? response.data.find((item) => item.id === groupId)
        : undefined;

      if (!selectedGroup) {
        setGroup(null);
        setError('Group not found or you are not a member.');
        return;
      }

      setGroup(selectedGroup);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this group. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, groupId]);

  useEffect(() => {
    setLoading(true);
    void loadGroup();
  }, [loadGroup]);

  useEffect(() => {
  if (!accessToken || !groupId) {
    setActivities([]);
    return;
  }

  let cancelled = false;

  async function loadActivity() {
    setLoadingActivities(true);
    setActivityError('');

    try {
      const response = await api.get<ActivityRecord[]>(
        `/groups/${groupId}/activity`,
        { params: { page: 1, limit: 20 } },
      );

      if (!cancelled) {
        setActivities(response.data);
      }
    } catch (err) {
      if (!cancelled) {
        setActivityError(
          getErrorMessage(err, 'Could not load group activity.'),
        );
      }
    } finally {
      if (!cancelled) {
        setLoadingActivities(false);
      }
    }
  }

  void loadActivity();

  return () => {
    cancelled = true;
  };
}, [accessToken, groupId]);

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!groupId || !memberEmail.trim()) {
      setMemberError('Enter the email address of the member you want to add.');
      return;
    }

    setAddingMember(true);
    setMemberError('');
    setMemberSuccess('');

    try {
      await api.post(`/groups/${groupId}/members`, {
        email: memberEmail.trim(),
      });

      setMemberEmail('');
      setMemberSuccess('Member added successfully.');
      await loadGroup();
    } catch (err) {
      setMemberError(getErrorMessage(err, 'Could not add this member.'));
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(member: GroupMember) {
    if (!groupId) return;

    const confirmed = window.confirm(
      `Remove ${member.user.name} from this group? Their outstanding balance must be zero.`,
    );

    if (!confirmed) return;

    setRemovingMember(member.userId);
    setMemberError('');
    setMemberSuccess('');

    try {
      await api.delete(`/groups/${groupId}/members/${member.userId}`);

      setMemberSuccess(`${member.user.name} was removed from the group.`);
      await loadGroup();
    } catch (err) {
      setMemberError(
        getErrorMessage(
          err,
          'Could not remove this member. Make sure their outstanding balance is zero.',
        ),
      );
    } finally {
      setRemovingMember(null);
    }
  }

  async function handleDeleteGroup() {
    if (!groupId || !group) return;

    const confirmed = window.confirm(
      `Permanently delete "${group.name}" and its associated data? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingGroup(true);
    setDeleteError('');

    try {
      await api.delete(`/groups/${groupId}`);
      navigate('/groups', { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete this group.'));
      setDeletingGroup(false);
    }
  }

  if (loading) {
    return (
      <main className="groups-page">
        <p>Loading group...</p>
      </main>
    );
  }

  if (error || !group) {
    return (
      <main className="groups-page">
        <Link to="/groups" className="groups-back-link">
          ← Back to My Groups
        </Link>
        <p className="groups-error" role="alert">
          {error || 'Group not found.'}
        </p>
      </main>
    );
  }

  const isOwner = user?.id === group.ownerId;

  return (
    <main className="groups-page group-details-page">
      <Link to="/groups" className="groups-back-link">
        ← Back to My Groups
      </Link>

      <header className="groups-page-header">
        <div>
          <h1>{group.name}</h1>
          <p>{group.description || 'No description provided.'}</p>
          <p>
            {group.members.length}{' '}
            {group.members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
      </header>

      {memberError && (
        <p className="groups-error" role="alert">{memberError}</p>
      )}

      {memberSuccess && (
        <p className="groups-success" role="status">{memberSuccess}</p>
      )}

      <section className="group-details-section">
        <GroupBalances groupId={group.id} members={group.members} />
      </section>

      <section className="group-details-section">
        <GroupExpenses groupId={group.id} members={group.members} />
      </section>
               <section className="group-details-section">
  <h2>Group activity</h2>

  {loadingActivities && <p>Loading activity...</p>}

  {activityError && (
    <p className="groups-error" role="alert">{activityError}</p>
  )}

  {!loadingActivities && !activityError && activities.length === 0 && (
    <p>No activity recorded yet.</p>
  )}

  {!loadingActivities && activities.length > 0 && (
    <div className="activity-timeline">
      {activities.map((activity) => (
        <article className="activity-timeline-item" key={activity.id}>
          <div className="activity-timeline-card">
            <strong>{activity.actor?.name ?? 'Former member'}</strong>
            <span className="activity-action-badge">
              {activity.action.replaceAll('_', ' ')}
            </span>
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

      <section className="group-details-section">
        <h2>Members</h2>

        <div className="group-members">
          {group.members.map((member) => (
            <div className="group-member" key={member.userId}>
              <span className="member-avatar">
                {member.user.name.charAt(0).toUpperCase()}
              </span>

              <div>
                <strong>{member.user.name}</strong>
                <span>{member.role === 'OWNER' ? 'Owner' : 'Member'}</span>
                <span>{member.user.email}</span>
              </div>

              {isOwner && member.userId !== group.ownerId && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={removingMember === member.userId}
                  onClick={() => void handleRemoveMember(member)}
                >
                  {removingMember === member.userId ? 'Removing...' : 'Remove'}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {isOwner && (
        <section className="group-details-section">
          <h2>Group management</h2>

          <form className="add-member-form" onSubmit={handleAddMember}>
            <label htmlFor="member-email">Add a member by email</label>
            <input
              id="member-email"
              type="email"
              value={memberEmail}
              onChange={(event) => setMemberEmail(event.target.value)}
              placeholder="member@example.com"
              required
            />

            <button type="submit" disabled={addingMember}>
              {addingMember ? 'Adding member...' : 'Add member'}
            </button>
          </form>

          <div className="group-delete-actions">
            <button
              type="button"
              className="danger-button"
              onClick={() => void handleDeleteGroup()}
              disabled={deletingGroup}
            >
              {deletingGroup ? 'Deleting group...' : 'Delete group'}
            </button>
          </div>

          {deleteError && (
            <p className="groups-error" role="alert">{deleteError}</p>
          )}
        </section>
      )}
    </main>
  );
}

export default GroupDetailsPage;
