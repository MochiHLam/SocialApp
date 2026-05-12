import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { useUpdateProfile } from '../../hooks/useUpdateProfile.js';
import { useUploadAvatar } from '../../hooks/useUploadAvatar.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import {
  getUserProfile,
  createFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from '../../lib/api.js';

const GENDERS = ['Male', 'Female', 'Other'];
const MAX_BIO_CHARACTERS = 280;
const MAX_BIO_LINES = 4;
function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return 'None';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'None';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function countBioLines(value) {
  const normalized = value?.trim() || '';
  if (!normalized) return 0;
  return normalized.replace(/\r\n?/g, '\n').split('\n').length;
}

function createFormState(user) {
  return {
    displayName: user?.displayName || '',
    gender: user?.gender || '',
    dateOfBirth: toDateInputValue(user?.dateOfBirth),
    bio: user?.bio || '',
    location: user?.location || '',
  };
}

function UserAvatar({ user, size = 'lg', className = '' }) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = size === 'xl' ? 'w-24 h-24 text-4xl' : size === 'lg' ? 'w-20 h-20 text-3xl' : 'w-10 h-10 text-sm';
  const label = (user?.displayName?.[0] || user?.email?.[0] || '?').toUpperCase();

  if (user?.avatarUrl && !imgError) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center ${className}`}
      aria-hidden
    >
      {label}
    </div>
  );
}

function EditProfileModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState(() => createFormState(user));
  const [bioError, setBioError] = useState('');
  const { isLoading: loading, handleUpdateProfile } = useUpdateProfile({ onSaved, onClose });

  useEffect(() => {
    setForm(createFormState(user));
    setBioError('');
  }, [user]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBioChange = (value) => {
    if (countBioLines(value) > MAX_BIO_LINES) {
      setBioError(`Bio must be at most ${MAX_BIO_LINES} lines long.`);
      return;
    }

    setBioError('');
    updateField('bio', value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (bioError) {
      toast.error(bioError);
      return;
    }
    await handleUpdateProfile(form);
  };

  const canSubmit =
    !loading &&
    form.displayName.trim() &&
    form.gender &&
    form.dateOfBirth &&
    !bioError;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f0f2f5] px-6 py-4">
          <h2 className="text-lg font-bold text-[#1c1e21]">Edit profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#65676b] transition-colors hover:bg-[#f0f2f5]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form className="space-y-4 px-6 py-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#65676b]">
              Display name
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              className="rounded-lg border border-[#dddfe2] px-4 py-2.5 text-sm text-[#1c1e21] outline-none transition-colors focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#65676b]">
              Bio
            </label>
            <textarea
              rows={MAX_BIO_LINES}
              maxLength={MAX_BIO_CHARACTERS}
              value={form.bio}
              onChange={(e) => handleBioChange(e.target.value)}
              placeholder="Write something about yourself..."
              className="resize-none rounded-lg border border-[#dddfe2] px-4 py-2.5 text-sm text-[#1c1e21] outline-none transition-colors focus:border-indigo-500"
            />
            <div className="flex items-center justify-between gap-3 text-xs text-[#8a8d91]">
              <span className={bioError ? 'text-red-600' : ''}>
                {bioError || `${form.bio.length}/${MAX_BIO_CHARACTERS} characters · ${countBioLines(form.bio)}/${MAX_BIO_LINES} lines`}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#65676b]">
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder="Your city or country"
              className="rounded-lg border border-[#dddfe2] px-4 py-2.5 text-sm text-[#1c1e21] outline-none transition-colors focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#65676b]">
              Date of birth
            </label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => updateField('dateOfBirth', e.target.value)}
              className="rounded-lg border border-[#dddfe2] px-4 py-2.5 text-sm text-[#1c1e21] outline-none transition-colors focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#65676b]">
              Gender
            </label>
            <select
              value={form.gender}
              onChange={(e) => updateField('gender', e.target.value)}
              className="rounded-lg border border-[#dddfe2] bg-white px-4 py-2.5 text-sm text-[#1c1e21] outline-none transition-colors focus:border-indigo-500"
            >
              <option value="">Select gender</option>
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {gender}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#f0f2f5] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-5 py-2 text-sm font-semibold text-[#65676b] transition-colors hover:bg-[#f0f2f5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {loading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AvatarModalShell({ title, onClose, children, modalClassName = 'max-w-sm' }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className={`w-full ${modalClassName} rounded-2xl bg-white shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#f0f2f5] px-6 py-4">
          <h2 className="text-lg font-bold text-[#1c1e21]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#65676b] transition-colors hover:bg-[#f0f2f5]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AvatarModal({ onClose, onSaved }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const { isLoading: loading, validateAvatarFile, handleUploadAvatar } = useUploadAvatar({ onSaved, onClose });

  function closeAll() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  }

  function resetFileInput() {
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = validateAvatarFile(file);
    if (!check.valid) {
      toast.error(check.message);
      resetFileInput();
      return;
    }

    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    resetFileInput();
  }

  function handlePreviewCancel() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
  }

  async function handleConfirm() {
    if (!pendingFile) return;
    const success = await handleUploadAvatar(pendingFile);
    if (success) {
      closeAll();
    }
  }

  if (previewUrl) {
    return (
      <AvatarModalShell title="Confirm profile picture" onClose={closeAll} modalClassName="max-w-md">
        <div className="flex flex-col items-center gap-5 px-8 py-8">
          <img src={previewUrl} alt="" className="h-48 w-48 rounded-full object-cover shadow-md" />
          <p className="text-center text-sm text-[#65676b]">Use this photo as your profile picture?</p>
        </div>
        <div className="flex gap-3 border-t border-[#f0f2f5] px-8 py-5">
          <button
            type="button"
            onClick={handlePreviewCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-[#e4e6eb] py-2 text-sm font-semibold text-[#65676b] transition-colors hover:bg-[#f0f2f5] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </AvatarModalShell>
    );
  }

  return (
    <AvatarModalShell title="Choose profile picture" onClose={closeAll}>
      <div className="flex justify-center px-6 py-8">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Upload photo
        </button>
      </div>
    </AvatarModalShell>
  );
}

export default function ProfileSectionView({ user, viewedProfile, displayName, onUserChange }) {
  const [editOpen, setEditOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const setAuthUser = useAuthStore((state) => state.setAuthUser);

  // --- Other-user profile state ---
  const [fetchedProfile, setFetchedProfile] = useState(null);
  const [relationStatus, setRelationStatus] = useState('none');
  const [friendRequestId, setFriendRequestId] = useState(null);
  const [relationshipId, setRelationshipId] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const isOwnProfile =
    !viewedProfile?.id ||
    (user?.id != null && String(viewedProfile.id) === String(user.id));

  const targetUserId = !isOwnProfile ? String(viewedProfile.id) : null;

  // Fetch other user's full profile + relationship on mount / when target changes
  useEffect(() => {
    if (!targetUserId) {
      setFetchedProfile(null);
      setRelationStatus('none');
      setFriendRequestId(null);
      setRelationshipId(null);
      return;
    }

    let cancelled = false;
    async function load() {
      setProfileLoading(true);
      try {
        const data = await getUserProfile({ userId: targetUserId });
        if (cancelled) return;
        const u = data?.user;
        if (u) {
          setFetchedProfile(u);
          setRelationStatus(u.relationshipStatus || 'none');
          setFriendRequestId(u.friendRequestId || null);
          setRelationshipId(u.relationshipId || null);
        }
      } catch {
        // keep whatever preview data we have
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [targetUserId]);

  const profileUser = isOwnProfile
    ? user
    : fetchedProfile || { ...viewedProfile };
  const currentName = profileUser?.displayName || displayName || 'User';

  const handleSaved = (nextUser) => {
    onUserChange?.(nextUser);
    setAuthUser(nextUser);
  };

  // --- Friend action handlers ---
  const handleAddFriend = async () => {
    try {
      setActionBusy(true);
      const res = await createFriendRequest({ receiverId: targetUserId });
      const reqId = res?.request?.requestId || res?.request?.id || null;
      setRelationStatus('requested');
      setFriendRequestId(reqId);
      toast.success(`Friend request sent to ${currentName}.`);
    } catch (err) {
      toast.error(err.message || 'Failed to send friend request');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!friendRequestId) return;
    try {
      setActionBusy(true);
      await cancelFriendRequest({ requestId: friendRequestId });
      setRelationStatus('none');
      setFriendRequestId(null);
      toast.success('Friend request cancelled.');
    } catch (err) {
      toast.error(err.message || 'Failed to cancel friend request');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!friendRequestId) return;
    try {
      setActionBusy(true);
      await acceptFriendRequest({ requestId: friendRequestId });
      setRelationStatus('friends');
      setFriendRequestId(null);
      toast.success('Friend request accepted!');
    } catch (err) {
      toast.error(err.message || 'Failed to accept request');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!friendRequestId) return;
    try {
      setActionBusy(true);
      await declineFriendRequest({ requestId: friendRequestId });
      setRelationStatus('none');
      setFriendRequestId(null);
      toast.success('Friend request declined.');
    } catch (err) {
      toast.error(err.message || 'Failed to decline request');
    } finally {
      setActionBusy(false);
    }
  };

  const handleUnfriend = async () => {
    if (!relationshipId) return;
    try {
      setActionBusy(true);
      await removeFriend({ relationshipId });
      setRelationStatus('none');
      setRelationshipId(null);
      toast.success(`${currentName} removed from friends.`);
    } catch (err) {
      toast.error(err.message || 'Failed to remove friend');
    } finally {
      setActionBusy(false);
    }
  };

  // --- Render action buttons for other user ---
  function renderFriendActionButtons() {
    if (isOwnProfile || profileLoading) return null;

    if (relationStatus === 'friends') {
      return (
        <button
          type="button"
          onClick={handleUnfriend}
          disabled={actionBusy}
          className="shrink-0 rounded-lg border border-[#e4e6eb] px-4 py-2 text-sm font-semibold text-[#1c1e21] transition-colors hover:bg-[#f0f2f5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Unfriend
        </button>
      );
    }

    if (relationStatus === 'requested') {
      return (
        <button
          type="button"
          onClick={handleCancelRequest}
          disabled={actionBusy}
          className="shrink-0 rounded-lg border border-[#e4e6eb] px-4 py-2 text-sm font-semibold text-[#1c1e21] transition-colors hover:bg-[#f0f2f5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel request
        </button>
      );
    }

    if (relationStatus === 'incoming') {
      return (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleDeclineRequest}
            disabled={actionBusy}
            className="rounded-lg border border-[#e4e6eb] px-4 py-2 text-sm font-semibold text-[#65676b] transition-colors hover:bg-[#f0f2f5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAcceptRequest}
            disabled={actionBusy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Accept
          </button>
        </div>
      );
    }

    // relationStatus === 'none'
    return (
      <button
        type="button"
        onClick={handleAddFriend}
        disabled={actionBusy}
        className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Add friend
      </button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-[#e4e6eb] bg-white p-5 shadow-[0_2px_4px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {isOwnProfile ? (
              <button
                type="button"
                onClick={() => setAvatarOpen(true)}
                className="block rounded-full focus:outline-none"
              >
                <UserAvatar user={profileUser} size="xl" />
              </button>
            ) : (
              <UserAvatar user={profileUser} size="xl" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#1c1e21]">{currentName}</h1>
            <p className="mt-1 text-sm text-[#65676b]">
              {isOwnProfile ? user?.bio || 'No bio yet' : profileUser?.bio || '—'}
            </p>
            {isOwnProfile ? <p className="mt-1 text-sm text-[#8a8d91]">0 friend(s)</p> : null}
          </div>
        </div>

        {isOwnProfile ? (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="shrink-0 rounded-lg border border-[#e4e6eb] px-4 py-2 text-sm font-semibold text-[#65676b] transition-colors hover:bg-[#f0f2f5]"
          >
            Edit profile
          </button>
        ) : renderFriendActionButtons()}
      </div>

      <div className="rounded-xl border border-[#e4e6eb] bg-white p-5 shadow-[0_2px_4px_rgba(0,0,0,0.06)]">
        <h2 className="mb-4 text-base font-bold text-[#1c1e21]">About</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 shrink-0 text-[#65676b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636" />
            </svg>
            <span className="text-sm text-[#1c1e21]">{profileUser?.gender || '—'}</span>
          </div>
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 shrink-0 text-[#65676b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-sm text-[#1c1e21]">{formatDate(profileUser?.dateOfBirth)}</span>
          </div>
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 shrink-0 text-[#65676b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="text-sm text-[#1c1e21]">{profileUser?.location || '—'}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#e4e6eb] bg-white p-6 text-center shadow-[0_2px_4px_rgba(0,0,0,0.06)]">
        <p className="text-base font-semibold text-[#1c1e21]">No posts yet</p>
        <p className="mt-1 text-sm text-[#65676b]">
          {isOwnProfile ? 'Your future posts will appear here.' : 'Posts will show here after the API is connected.'}
        </p>
      </div>

      {isOwnProfile && editOpen && (
        <EditProfileModal
          user={profileUser}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {isOwnProfile && avatarOpen && <AvatarModal onClose={() => setAvatarOpen(false)} onSaved={handleSaved} />}
    </div>
  );
}
