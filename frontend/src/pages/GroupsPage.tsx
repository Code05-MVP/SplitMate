
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import GroupExpenses from '../components/GroupExpenses';
import GroupBalances from '../components/GroupBalances';

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

function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (
      err as {
        response?: { data?: { message?: string | string[] } };
      }
    ).response;

    const message = response?.data?.message;

    if (Array.isArray(message)) return message.join(' ');
    if (message) return message;
  }

  return fallback;
}

function GroupsPage() {
  const {
    accessToken,
    user,
    isLoading: authLoading,
  } = useAuth();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const [deletingGroup, setDeletingGroup] = useState<string | null>(null);
  const [groupDeleteErrors, setGroupDeleteErrors] = useState<
    Record<string, string>
  >({});

  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [memberErrors, setMemberErrors] = useState<Record<string, string>>({});
  const [memberSuccess, setMemberSuccess] = useState<Record<string, string>>(
    {},
  );
  const [addingMember, setAddingMember] = useState<string | null>(null);

  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [memberRemovalErrors, setMemberRemovalErrors] = useState<
    Record<string, string>
  >({});

  const fetchGroups = useCallback(async () => {
    if (!accessToken) {
      setGroups([]);
      setLoading(false);
      setError('Please log in to view your groups.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.get<Group[]>('/groups', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setGroups(response.data);
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, 'Could not load groups. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading) return;
    void fetchGroups();
  }, [authLoading, fetchGroups]);

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

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

    if (!accessToken) {
      setFormError('Your session has expired. Please log in again.');
      return;
    }

    setCreating(true);

    try {
      await api.post(
        '/groups',
        {
          name,
          ...(groupDescription ? { description: groupDescription } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      setGroupName('');
      setDescription('');
      setShowForm(false);
      setSuccessMessage(`Group "${name}" created successfully.`);

      await fetchGroups();
    } catch (err: unknown) {
      setFormError(
        getErrorMessage(err, 'Could not create the group. Please try again.'),
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleAddMember(
    event: FormEvent<HTMLFormElement>,
    groupId: string,
  ) {
    event.preventDefault();

    setMemberErrors((previous) => ({ ...previous, [groupId]: '' }));
    setMemberSuccess((previous) => ({ ...previous, [groupId]: '' }));

    const email = (memberEmails[groupId] ?? '').trim().toLowerCase();

    if (!email) {
      setMemberErrors((previous) => ({
        ...previous,
        [groupId]: 'Please enter an email address.',
      }));
      return;
    }

    if (!accessToken) {
      setMemberErrors((previous) => ({
        ...previous,
        [groupId]: 'Your session has expired. Please log in again.',
      }));
      return;
    }

    setAddingMember(groupId);

    try {
      await api.post(
        `/groups/${groupId}/members`,
        { email },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      setMemberEmails((previous) => ({
        ...previous,
        [groupId]: '',
      }));

      setMemberSuccess((previous) => ({
        ...previous,
        [groupId]: 'Member added successfully!',
      }));

      await fetchGroups();
    } catch (err: unknown) {
      setMemberErrors((previous) => ({
        ...previous,
        [groupId]: getErrorMessage(
          err,
          'Could not add this member. Please try again.',
        ),
      }));
    } finally {
      setAddingMember(null);
    }
  }

  async function handleRemoveMember(groupId: string, memberId: string) {
    const removalKey = `${groupId}-${memberId}`;

    const confirmed = window.confirm(
      'Are you sure you want to remove this member from the group? ' +
        'The member can only be removed if their outstanding group balance is zero.',
    );

    if (!confirmed) return;

    if (!accessToken) {
      setMemberRemovalErrors((previous) => ({
        ...previous,
        [removalKey]: 'Your session has expired. Please log in again.',
      }));
      return;
    }

    setRemovingMember(removalKey);
    setMemberRemovalErrors((previous) => ({
      ...previous,
      [removalKey]: '',
    }));

    try {
      await api.delete(`/groups/${groupId}/members/${memberId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      await fetchGroups();
    } catch (err: unknown) {
      setMemberRemovalErrors((previous) => ({
        ...previous,
        [removalKey]: getErrorMessage(
          err,
          'Could not remove this member. They may have an outstanding balance.',
        ),
      }));
    } finally {
      setRemovingMember(null);
    }
  }

  async function handleDeleteGroup(groupId: string, groupName: string) {
    const confirmed = window.confirm(
      `Permanently delete "${groupName}" and its expenses, settlements, members, and activity history? This cannot be undone.`,
    );

    if (!confirmed) return;

    if (!accessToken) {
      setGroupDeleteErrors((previous) => ({
        ...previous,
        [groupId]: 'Your session has expired. Please log in again.',
      }));
      return;
    }

    setDeletingGroup(groupId);
    setGroupDeleteErrors((previous) => ({
      ...previous,
      [groupId]: '',
    }));
    setSuccessMessage('');

    try {
      await api.delete(`/groups/${groupId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setSuccessMessage(`Group "${groupName}" deleted successfully.`);
      await fetchGroups();
    } catch (err: unknown) {
      setGroupDeleteErrors((previous) => ({
        ...previous,
        [groupId]: getErrorMessage(
          err,
          'Could not delete this group. Please try again.',
        ),
      }));
    } finally {
      setDeletingGroup(null);
    }
  }

  return (
    <main className="groups-page">
      <header className="groups-page-header">
        <div>
          <Link to="/" className="groups-back-link">
            ← Back to home
          </Link>

          <h1>My Groups</h1>
          <p>Your shared expenses, organized in one place.</p>
        </div>

        <button
          className="create-group-button"
          type="button"
          onClick={() => {
            setShowForm((previous) => !previous);
            setFormError('');
            setSuccessMessage('');
          }}
          disabled={!accessToken || authLoading}
        >
          {showForm ? 'Cancel' : '+ Create group'}
        </button>
      </header>

      {showForm && (
        <section className="create-group-panel">
          <h2>Create a new group</h2>
          <p>Start organizing shared expenses with your friends.</p>

          <form onSubmit={handleCreateGroup}>
            <label htmlFor="groupName">Group name</label>
            <input
              id="groupName"
              type="text"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="e.g. Goa Trip"
              minLength={2}
              maxLength={100}
              required
              disabled={creating}
            />

            <label htmlFor="groupDescription">
              Description <span>(optional)</span>
            </label>

            <textarea
              id="groupDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this group for?"
              maxLength={500}
              rows={3}
              disabled={creating}
            />

            {formError && (
              <p className="groups-error" role="alert">
                {formError}
              </p>
            )}

            <button
              className="create-group-button"
              type="submit"
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Create group'}
            </button>
          </form>
        </section>
      )}

      {successMessage && (
        <p className="groups-success" role="status">
          {successMessage}
        </p>
      )}

      {authLoading || loading ? (
        <p role="status">Loading your groups...</p>
      ) : error ? (
        <section className="groups-message groups-error" role="alert">
          {error}

          {!accessToken && (
            <p>
              <Link to="/login">Go to login</Link>
            </p>
          )}

          <button type="button" onClick={() => void fetchGroups()}>
            Try again
          </button>
        </section>
      ) : groups.length === 0 ? (
        <section className="groups-empty">
          <div className="groups-empty-icon">＋</div>
          <h2>No groups yet</h2>
          <p>Create your first group to start splitting expenses.</p>
        </section>
      ) : (
        <>
          <p className="groups-count">
            {groups.length} {groups.length === 1 ? 'group' : 'groups'}
          </p>

          <div className="groups-grid">
            {groups.map((group) => (
              <article className="group-card" key={group.id}>
                <div className="group-card-icon">♧</div>

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

                <div className="group-members">
                  {group.members.map((member) => {
                    const removalKey = `${group.id}-${member.userId}`;
                    const isRemoving = removingMember === removalKey;

                    return (
                      <div className="group-member" key={member.userId}>
                        <span className="member-avatar">
                          {member.user.name.charAt(0).toUpperCase()}
                        </span>

                        <div className="group-member-info">
                          <strong>{member.user.name}</strong>
                          <span>
                            {member.role === 'OWNER' ? 'Owner' : 'Member'}
                          </span>
                        </div>

                        {user &&
                          group.ownerId === user.id &&
                          member.userId !== group.ownerId && (
                            <button
                              type="button"
                              className="remove-member-button"
                              onClick={() =>
                                void handleRemoveMember(
                                  group.id,
                                  member.userId,
                                )
                              }
                              disabled={
                                isRemoving || removingMember !== null
                              }
                            >
                              {isRemoving ? 'Removing...' : 'Remove'}
                            </button>
                          )}

                        {memberRemovalErrors[removalKey] && (
                          <p
                            className="groups-error member-removal-error"
                            role="alert"
                          >
                            {memberRemovalErrors[removalKey]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <GroupBalances
                  groupId={group.id}
                  members={group.members}
                />

                <GroupExpenses
                  groupId={group.id}
                  members={group.members}
                />

                {user && group.ownerId === user.id && (
                  <>
                    <form
                      className="add-member-form"
                      onSubmit={(event) =>
                        void handleAddMember(event, group.id)
                      }
                    >
                      <label htmlFor={`member-email-${group.id}`}>
                        Add a member by email
                      </label>

                      <input
                        id={`member-email-${group.id}`}
                        type="email"
                        value={memberEmails[group.id] ?? ''}
                        onChange={(event) =>
                          setMemberEmails((previous) => ({
                            ...previous,
                            [group.id]: event.target.value,
                          }))
                        }
                        placeholder="friend@example.com"
                        required
                        disabled={addingMember === group.id}
                      />

                      <button
                        className="create-group-button"
                        type="submit"
                        disabled={addingMember === group.id}
                      >
                        {addingMember === group.id
                          ? 'Adding...'
                          : 'Add member'}
                      </button>

                      {memberErrors[group.id] && (
                        <p className="groups-error" role="alert">
                          {memberErrors[group.id]}
                        </p>
                      )}

                      {memberSuccess[group.id] && (
                        <p className="groups-success" role="status">
                          {memberSuccess[group.id]}
                        </p>
                      )}
                    </form>

                    <div className="group-delete-actions">
                      <button
                        type="button"
                        className="delete-group-button"
                        disabled={deletingGroup !== null}
                        onClick={() =>
                          void handleDeleteGroup(group.id, group.name)
                        }
                      >
                        {deletingGroup === group.id
                          ? 'Deleting group...'
                          : 'Delete Group'}
                      </button>

                      {groupDeleteErrors[group.id] && (
                        <p className="groups-error" role="alert">
                          {groupDeleteErrors[group.id]}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

export default GroupsPage;
