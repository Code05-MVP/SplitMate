
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { createRealtimeSocket } from '../realtime/socket';
import { readAccessToken } from '../api/tokenHandler';

interface GroupBalance {
  userId: string;
  balancePaise: number;
  balanceRupees: number;
}

interface GroupMember {
  userId: string;
  user: {
    name: string;
    email: string;
  };
}

interface GroupBalancesProps {
  groupId: string;
  members: GroupMember[];
}

function GroupBalances({ groupId, members }: GroupBalancesProps) {
  const { accessToken, user, refreshAccessToken } = useAuth();

  const [balances, setBalances] = useState<GroupBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementError, setSettlementError] = useState('');
  const [settlementSuccess, setSettlementSuccess] = useState('');

  const fetchBalances = useCallback(async () => {
    if (!accessToken) {
      setBalances([]);
      setLoading(false);
      setError('Please log in to view balances.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.get<GroupBalance[]>(
        `/groups/${groupId}/balances`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!Array.isArray(response.data)) {
        throw new Error('Unexpected balances API response');
      }

      setBalances(response.data);
    } catch {
      setError('Could not load balances. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, groupId]);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  useEffect(() => {
  if (!accessToken) return;

  const socket = createRealtimeSocket(readAccessToken);

  const handleDisconnect = (reason: string) => {
    console.log('[Balances Socket] Disconnected:', reason);

    if (reason === 'io server disconnect') {
      console.log('[Balances Socket] Refreshing access token...');

      void refreshAccessToken()
        .then(() => {
          console.log('[Balances Socket] Access token refreshed.');
        })
        .catch((error) => {
          console.error('[Balances Socket] Token refresh failed:', error);

          window.dispatchEvent(
            new Event('splitmate:session-expired'),
          );
        });
    }
  };

  const joinGroup = () => {
    socket.emit('group:join', { groupId });
    void fetchBalances();
  };

  const refreshBalances = () => {
    void fetchBalances();
  };

  socket.on('disconnect', handleDisconnect);
  socket.on('connect', joinGroup);

  socket.on('group:balance-updated', refreshBalances);
  socket.on('group:expense-created', refreshBalances);
  socket.on('group:expense-updated', refreshBalances);
  socket.on('group:expense-deleted', refreshBalances);

  socket.connect();

  return () => {
    socket.off('disconnect', handleDisconnect);
    socket.off('connect', joinGroup);
    socket.off('group:balance-updated', refreshBalances);
    socket.off('group:expense-created', refreshBalances);
    socket.off('group:expense-updated', refreshBalances);
    socket.off('group:expense-deleted', refreshBalances);
    socket.disconnect();
  };
}, [accessToken, groupId, fetchBalances, refreshAccessToken]);

  async function handleSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettlementError('');
    setSettlementSuccess('');

    if (!accessToken) {
      setSettlementError('Please log in to record a settlement.');
      return;
    }

    const amountRupees = Number(amount);

    if (
      !amount.trim() ||
      !Number.isFinite(amountRupees) ||
      amountRupees <= 0
    ) {
      setSettlementError('Enter an amount greater than zero.');
      return;
    }

    // Accept at most two decimal places (paise).
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      setSettlementError('Enter an amount with up to two decimal places.');
      return;
    }

    const amountPaise = Math.round(amountRupees * 100);

    if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
      setSettlementError('Enter a valid payment amount.');
      return;
    }

    if (!receiverId || receiverId === user?.id) {
      setSettlementError('Select another group member to receive the payment.');
      return;
    }

    try {
      setSettlementLoading(true);

      await api.post(
        `/groups/${groupId}/settlements`,
        { receiverId, amountPaise },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      setSettlementSuccess('Payment recorded successfully.');
      setAmount('');
      setReceiverId('');
      setShowSettlementForm(false);

      await fetchBalances();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof err.response === 'object' &&
        err.response !== null &&
        'data' in err.response &&
        typeof err.response.data === 'object' &&
        err.response.data !== null &&
        'message' in err.response.data &&
        typeof err.response.data.message === 'string'
          ? err.response.data.message
          : 'Could not record payment. Check the amount and try again.';

      setSettlementError(message);
    } finally {
      setSettlementLoading(false);
    }
  }

  const currency = (paise: number) =>
    (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <section className="my-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">
            Group balances
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            See who owes money and who gets paid back.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowSettlementForm((current) => !current);
            setSettlementError('');
            setSettlementSuccess('');
          }}
          disabled={loading || Boolean(error) || settlementLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showSettlementForm ? 'Cancel' : 'Settle Up'}
        </button>
      </div>

      {loading ? (
        <div
          className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500"
          role="status"
        >
          Loading balances…
        </div>
      ) : error ? (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          role="alert"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void fetchBalances()}
            className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 font-semibold transition hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : balances.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No member balances available yet.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white px-4">
          {balances.map((balance) => {
            const member = members.find(
              (item) => item.userId === balance.userId,
            );

            const amountPaise = Math.round(
              balance.balanceRupees * 100,
            ) || balance.balancePaise;

            const isPositive = amountPaise > 0;
            const isNegative = amountPaise < 0;

            return (
              <li
                key={balance.userId}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-semibold text-indigo-700">
                    {(member?.user.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">
                      {member?.user.name ?? 'Unknown member'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {isPositive
                        ? 'Gets back'
                        : isNegative
                          ? 'Owes'
                          : 'All settled'}
                    </p>
                  </div>
                </div>

                <p
                  className={`text-sm font-bold tabular-nums ${
                    isPositive
                      ? 'text-emerald-700'
                      : isNegative
                        ? 'text-amber-700'
                        : 'text-slate-500'
                  }`}
                >
                  {amountPaise === 0
                    ? '₹0.00'
                    : currency(Math.abs(amountPaise))}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {settlementSuccess && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          role="status"
        >
          {settlementSuccess}
        </div>
      )}

      {showSettlementForm && (
        <form
          onSubmit={handleSettlement}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div>
            <h4 className="text-lg font-bold text-slate-900">
              Record a settlement
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Record a payment made between group members.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="settlement-receiver"
              className="block text-sm font-semibold text-slate-700"
            >
              Payment received by
            </label>
            <select
              id="settlement-receiver"
              value={receiverId}
              onChange={(event) => setReceiverId(event.target.value)}
              required
              disabled={settlementLoading}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">Select a member</option>
              {members
                .filter((member) => member.userId !== user?.id)
                .map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="settlement-amount"
              className="block text-sm font-semibold text-slate-700"
            >
              Amount (₹)
            </label>
            <input
              id="settlement-amount"
              type="number"
              min="0.01"
              step="0.01"
              max="100000000"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
              disabled={settlementLoading}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
            <p className="text-xs text-slate-500">
              Enter the payment amount in rupees, up to two decimal places.
            </p>
          </div>

          {settlementError && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {settlementError}
            </div>
          )}

          <button
            type="submit"
            disabled={settlementLoading || loading || Boolean(error)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {settlementLoading ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                Recording payment…
              </>
            ) : (
              'Record Payment'
            )}
          </button>
        </form>
      )}
    </section>
  );
}

export default GroupBalances;
