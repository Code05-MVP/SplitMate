
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { createRealtimeSocket } from '../realtime/socket';

interface ExpenseMember {
  userId: string;
  role: string;
  user: {
    name: string;
    email: string;
  };
}

interface GroupExpensesProps {
  groupId: string;
  members: ExpenseMember[];
}

interface ExpenseSplit {
  id: string;
  userId: string;
  sharePaise: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

   
interface Expense {
  id: string;
  description: string;
  amountPaise: number;
  expenseDate: string;
  createdAt: string;
  splitType: 'EQUAL' | 'CUSTOM';
  creator: {
    id: string;
  };
  payer: {
    id: string;
    name: string;
    email: string;
  };
  splits: ExpenseSplit[];
}


interface ExpenseListResponse {
  data: Expense[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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

function GroupExpenses({ groupId, members }: GroupExpensesProps) {
    const { accessToken, user } = useAuth();

  // Expense history state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [sortBy, setSortBy] = useState<
    'expenseDate' | 'amountPaise'
  >('expenseDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expenseListError, setExpenseListError] = useState('');

  // Add expense form state
  const [showForm, setShowForm] = useState(false);
  
 const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
 const [updatingExpense, setUpdatingExpense] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [payerId, setPayerId] = useState('');
  const [splitType, setSplitType] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [customShares, setCustomShares] = useState<Record<string, string>>(
    {},
  );
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const amountPaise = Math.round(Number(amount) * 100);

  const fetchExpenses = useCallback(async () => {
    if (!accessToken) {
      setExpenseListError('Please log in again to view expenses.');
      setExpenses([]);
      return;
    }

    setLoadingExpenses(true);
    setExpenseListError('');

    try {
      const response = await api.get<ExpenseListResponse>(
        `/groups/${groupId}/expenses`,
        {
          params: {
            page,
            limit: 10,
            sortBy,
            order: sortOrder,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      setExpenses(response.data.data);
      setTotalPages(response.data.pagination.totalPages);
      setTotalExpenses(response.data.pagination.total);
    } catch (err: unknown) {
      setExpenseListError(
        getErrorMessage(err, 'Could not load expenses. Please try again.'),
      );
    } finally {
      setLoadingExpenses(false);
    }
  }, [accessToken, groupId, page, sortBy, sortOrder]);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);
  
useEffect(() => {
  if (!accessToken) {
    return;
  }

  const socket = createRealtimeSocket(accessToken);

  socket.on('connect', () => {
    socket.emit('group:join', { groupId });
  });

  const refreshExpenses = () => {
    void fetchExpenses();
  };
      
socket.on('group:expense-created', refreshExpenses);
socket.on('group:expense-updated', refreshExpenses);
socket.on('group:expense-deleted', refreshExpenses);
socket.on('group:balance-updated', refreshExpenses);
socket.on('group:activity-updated', refreshExpenses);


  socket.connect();

  return () => {
    socket.disconnect();
  };
}, [accessToken, groupId, fetchExpenses]);


  function toggleMember(userId: string, checked: boolean) {
    setSelectedMemberIds((previous) =>
      checked
        ? [...previous, userId]
        : previous.filter((id) => id !== userId),
    );
  }
                  
async function handleUpdateExpense(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setFormError('');
  setSuccessMessage('');

  if (!accessToken || !editingExpenseId) {
    setFormError('Your session has expired. Please log in again.');
    return;
  }

  if (!description.trim()) {
    setFormError('Please enter an expense description.');
    return;
  }

  if (!Number.isFinite(Number(amount)) || amountPaise < 1) {
    setFormError('Enter a valid amount greater than zero.');
    return;
  }

  if (!payerId) {
    setFormError('Please select who paid for this expense.');
    return;
  }

  if (selectedMemberIds.length === 0) {
    setFormError('Select at least one member to split this expense.');
    return;
  }

  let splits: { userId: string; sharePaise?: number }[];

  if (splitType === 'EQUAL') {
    splits = selectedMemberIds.map((userId) => ({ userId }));
  } else {
    splits = [];

    for (const userId of selectedMemberIds) {
      const shareText = customShares[userId] ?? '';
      const shareRupees = Number(shareText);
      const sharePaise = Math.round(shareRupees * 100);

      if (
        !shareText.trim() ||
        !Number.isFinite(shareRupees) ||
        sharePaise < 1
      ) {
        setFormError(
          `Enter a valid positive share for ${
            members.find((member) => member.userId === userId)?.user.name ??
            'each selected member'
          }.`,
        );
        return;
      }

      splits.push({ userId, sharePaise });
    }

    const totalShares = splits.reduce(
      (total, split) => total + (split.sharePaise ?? 0),
      0,
    );

    if (totalShares !== amountPaise) {
      setFormError(
        `Shares total ₹${(totalShares / 100).toFixed(2)}, but the expense is ₹${(amountPaise / 100).toFixed(2)}.`,
      );
      return;
    }
  }

  setUpdatingExpense(true);

  try {
    await api.patch(
      `/groups/${groupId}/expenses/${editingExpenseId}`,
      {
        description: description.trim(),
        amountPaise,
        expenseDate: new Date(`${expenseDate}T12:00:00`).toISOString(),
        splitType,
        payerId,
        splits,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    setSuccessMessage('Expense updated successfully!');
    setEditingExpenseId(null);
    setDescription('');
    setAmount('');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setPayerId('');
    setSplitType('EQUAL');
    setSelectedMemberIds([]);
    setCustomShares({});
    setShowForm(false);

    await fetchExpenses();
  } catch (err: unknown) {
    setFormError(
      getErrorMessage(err, 'Could not update the expense. Please try again.'),
    );
  } finally {
    setUpdatingExpense(false);
  }
}

              
function handleEditExpense(expense: Expense) {
  setFormError('');
  setSuccessMessage('');

  setEditingExpenseId(expense.id);
  setDescription(expense.description);
  setAmount((expense.amountPaise / 100).toFixed(2));
  setExpenseDate(new Date(expense.expenseDate).toISOString().slice(0, 10));
  setPayerId(expense.payer.id);
  setSplitType(expense.splitType);

  const memberIds = expense.splits.map((split) => split.userId);
  setSelectedMemberIds(memberIds);

  const shares: Record<string, string> = {};

  for (const split of expense.splits) {
    shares[split.userId] = (split.sharePaise / 100).toFixed(2);
  }

  setCustomShares(shares);
  setShowForm(true);
}

  async function handleCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!accessToken) {
      setFormError('Your session has expired. Please log in again.');
      return;
    }

    if (!description.trim()) {
      setFormError('Please enter an expense description.');
      return;
    }

    if (!Number.isFinite(Number(amount)) || amountPaise < 1) {
      setFormError('Enter a valid amount greater than zero.');
      return;
    }

    if (!payerId) {
      setFormError('Please select who paid for this expense.');
      return;
    }

    if (selectedMemberIds.length === 0) {
      setFormError('Select at least one member to split this expense.');
      return;
    }

    let splits: { userId: string; sharePaise?: number }[];

    if (splitType === 'EQUAL') {
      splits = selectedMemberIds.map((userId) => ({ userId }));
    } else {
      splits = [];

      for (const userId of selectedMemberIds) {
        const shareText = customShares[userId] ?? '';
        const shareRupees = Number(shareText);
        const sharePaise = Math.round(shareRupees * 100);

        if (
          !shareText.trim() ||
          !Number.isFinite(shareRupees) ||
          sharePaise < 1
        ) {
          setFormError(
            `Enter a valid positive share for ${
              members.find((member) => member.userId === userId)?.user.name ??
              'each selected member'
            }.`,
          );
          return;
        }

        splits.push({ userId, sharePaise });
      }

      const totalShares = splits.reduce(
        (total, split) => total + (split.sharePaise ?? 0),
        0,
      );

      if (totalShares !== amountPaise) {
        setFormError(
          `Shares total ₹${(totalShares / 100).toFixed(2)}, but the expense is ₹${(amountPaise / 100).toFixed(2)}.`,
        );
        return;
      }
    }

    setSaving(true);

    try {
      await api.post(
        `/groups/${groupId}/expenses`,
        {
          description: description.trim(),
          amountPaise,
          expenseDate: new Date(`${expenseDate}T12:00:00`).toISOString(),
          splitType,
          payerId,
          splits,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      setSuccessMessage('Expense created successfully!');
      setDescription('');
      setAmount('');
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setPayerId('');
      setSplitType('EQUAL');
      setSelectedMemberIds([]);
      setCustomShares({});
      setShowForm(false);

      // Return to page 1 so the newly created expense is visible.
      setPage(1);

      // Refresh immediately when already on page 1.
      if (page === 1) {
        await fetchExpenses();
      }
    } catch (err: unknown) {
      setFormError(
        getErrorMessage(err, 'Could not create the expense. Please try again.'),
      );
    } finally {
      setSaving(false);
    }
  }
             
const handleDeleteExpense = async (expenseId: string) => {
  const confirmed = window.confirm(
    'Are you sure you want to delete this expense?'
  );

  if (!confirmed) {
    return;
  }
  

  try {
    setExpenseListError('');

    await api.delete(
      `/groups/${groupId}/expenses/${expenseId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    setSuccessMessage('Expense deleted successfully.');
    await fetchExpenses();
  } catch (error) {
    setExpenseListError(getErrorMessage(error, 'Failed to delete expense.'));
  }
};


  return (
    <section className="group-expenses">
      <h3>Expenses</h3>

         
<button
  className="create-group-button"
  type="button"
  onClick={() => {
    if (showForm) {
      // Close the form and exit edit mode.
      setShowForm(false);
      setEditingExpenseId(null);

      // Reset the form fields.
      setDescription('');
      setAmount('');
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setPayerId('');
      setSplitType('EQUAL');
      setSelectedMemberIds([]);
      setCustomShares({});
    } else {
      // Open a fresh Add Expense form.
      setShowForm(true);
      setEditingExpenseId(null);
      setDescription('');
      setAmount('');
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setPayerId('');
      setSplitType('EQUAL');
      setSelectedMemberIds([]);
      setCustomShares({});
    }

    setFormError('');
    setSuccessMessage('');
  }}
  disabled={saving || updatingExpense || members.length === 0}
>
  {showForm ? 'Cancel' : '+ Add expense'}
</button>


      {successMessage && (
        <p className="groups-success" role="status">
          {successMessage}
        </p>
      )}

      {showForm && (
        <form
         className="expense-form"
         onSubmit={editingExpenseId ? handleUpdateExpense : handleCreateExpense}>
          <label htmlFor={`expense-description-${groupId}`}>
            Description
          </label>
          <input
            id={`expense-description-${groupId}`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. Dinner"
            maxLength={255}
            required
            disabled={saving || updatingExpense}
          />

          <label htmlFor={`expense-amount-${groupId}`}>Amount (₹)</label>
          <input
            id={`expense-amount-${groupId}`}
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="e.g. 1200.00"
            required
            disabled={saving}
          />

          <label htmlFor={`expense-date-${groupId}`}>Expense date</label>
          <input
            id={`expense-date-${groupId}`}
            type="date"
            value={expenseDate}
            onChange={(event) => setExpenseDate(event.target.value)}
            required
            disabled={saving}
          />

          <label htmlFor={`expense-payer-${groupId}`}>Paid by</label>
          <select
            id={`expense-payer-${groupId}`}
            value={payerId}
            onChange={(event) => setPayerId(event.target.value)}
            required
            disabled={saving}
          >
            <option value="">Select payer</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.user.name} ({member.user.email})
              </option>
            ))}
          </select>

          <fieldset disabled={saving}>
            <legend>Split type</legend>

            <label>
              <input
                type="radio"
                name={`split-type-${groupId}`}
                checked={splitType === 'EQUAL'}
                onChange={() => setSplitType('EQUAL')}
              />
              Equal split
            </label>

            <label>
              <input
                type="radio"
                name={`split-type-${groupId}`}
                checked={splitType === 'CUSTOM'}
                onChange={() => setSplitType('CUSTOM')}
              />
              Custom split
            </label>
          </fieldset>

          <fieldset disabled={saving}>
            <legend>Select members sharing this expense</legend>

            {members.map((member) => (
              <div className="expense-member-option" key={member.userId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(member.userId)}
                    onChange={(event) =>
                      toggleMember(member.userId, event.target.checked)
                    }
                  />
                  {member.user.name}
                </label>

                {splitType === 'CUSTOM' &&
                  selectedMemberIds.includes(member.userId) && (
                    <label>
                      Share (₹)
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={customShares[member.userId] ?? ''}
                        onChange={(event) =>
                          setCustomShares((previous) => ({
                            ...previous,
                            [member.userId]: event.target.value,
                          }))
                        }
                        placeholder="0.00"
                        disabled={saving}
                      />
                    </label>
                  )}
              </div>
            ))}
          </fieldset>

          {formError && (
            <p className="groups-error" role="alert">
              {formError}
            </p>
          )}

          <button
            className="create-group-button"
            type="submit"
            disabled={saving}
          >
           {updatingExpense
  ? 'Updating expense...'
  : saving
    ? 'Saving expense...'
    : editingExpenseId
      ? 'Update expense'
      : 'Save expense'}
          </button>
        </form>
      )}

      <div className="expense-history">
        <h4>Expense history</h4>

        <p>Total expenses: {totalExpenses}</p>

        <div className="expense-controls">
          <label>
            Sort by
            <select
              value={sortBy}
              onChange={(event) => {
                setSortBy(
                  event.target.value as 'expenseDate' | 'amountPaise',
                );
                setPage(1);
              }}
            >
              <option value="expenseDate">Expense date</option>
              <option value="amountPaise">Amount</option>
            </select>
          </label>

          <label>
            Order
            <select
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as 'asc' | 'desc');
                setPage(1);
              }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>

        {loadingExpenses && <p>Loading expenses...</p>}

        {expenseListError && (
          <p className="groups-error" role="alert">
            {expenseListError}
          </p>
        )}

        {!loadingExpenses &&
          !expenseListError &&
          expenses.length === 0 && (
            <p>No expenses have been added to this group yet.</p>
          )}

        {!loadingExpenses &&
          expenses.map((expense) => (
            <article className="expense-card" key={expense.id}>
              <h5>{expense.description}</h5>
              
{accessToken && expense.creator.id === user?.id && (
  <div className="expense-actions">
    <button
      type="button"
       onClick={() => handleEditExpense(expense)}
    >
      Edit
    </button>

      
<button
  type="button"
  onClick={() => handleDeleteExpense(expense.id)}
>
  Delete
</button>

  </div>
)}


              <p>Amount: ₹{(expense.amountPaise / 100).toFixed(2)}</p>

              <p>Paid by: {expense.payer.name}</p>

              <p>
                Date: {new Date(expense.expenseDate).toLocaleDateString()}
              </p>

              <h6>Member shares</h6>

              <ul>
                {expense.splits.map((split) => (
                  <li key={split.id}>
                    {split.user.name}: ₹
                    {(split.sharePaise / 100).toFixed(2)}
                  </li>
                ))}
              </ul>
            </article>
          ))}

        {totalPages > 1 && (
          <div className="expense-pagination">
            <button
              type="button"
              disabled={page <= 1 || loadingExpenses}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>

            <span>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages || loadingExpenses}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default GroupExpenses;
