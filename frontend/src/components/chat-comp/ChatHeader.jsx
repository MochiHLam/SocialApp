import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAvatarUrl } from "../../lib/avatarUrl.js";
import { getFriends } from "../../lib/api.js";
import { getPresenceMeta } from "../../lib/chatPresence.js";

/* ─── Member List View ──────────────────────────────────────── */
function MemberListView({ chat, currentUser, isOwner, onAddMember, onRemoveMember, onViewProfile }) {
  const [search, setSearch] = useState("");
  const members = chat.members ?? [];
  const filtered = members.filter((m) =>
    (m.displayName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8d91]"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members..."
          className="w-full rounded-full border border-[#dddfe2] bg-[#f0f2f5] py-2 pl-9 pr-4 text-sm outline-none transition-colors focus:border-indigo-400 focus:bg-white"
        />
      </div>

      {/* Member list */}
      <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <svg className="h-9 w-9 text-[#ccd0d5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <p className="text-sm text-[#65676b]">No members yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#8a8d91]">No members match "{search}".</p>
        ) : (
          filtered.map((m) => {
            const isSelf = String(m.id) === String(currentUser?.id);
            const isGroupOwner = String(m.id) === String(chat.ownerId);
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-[#f0f2f5]">
                {/* Clickable avatar + name → view profile */}
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => onViewProfile?.(m.id)}
                >
                  <img
                    src={getAvatarUrl(m.avatarUrl)}
                    alt={m.displayName}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                    onError={(e) => { e.currentTarget.src = "/basic_avatar.jpg"; }}
                  />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#1c1e21]">
                    {m.displayName}
                    {isSelf && <span className="ml-1 font-normal text-[#8a8d91]">(You)</span>}
                    {isGroupOwner && <span className="ml-1 font-normal text-indigo-600">(Owner)</span>}
                  </p>
                </button>
                {isOwner && !isSelf && (
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50 hover:border-red-300"
                    onClick={async () => {
                      try {
                        await onRemoveMember?.(m);
                      } catch (err) {
                        window.alert(err.message || "Failed to remove member");
                      }
                    }}
                  >
                    Kick
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add member */}
      {isOwner && (
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-[#dddfe2] px-3 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
          onClick={onAddMember}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add member
        </button>
      )}
    </div>
  );
}

/* ─── Add Member View ───────────────────────────────────────── */
function AddMemberView({ chat, onAddMember, onViewProfile }) {
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(new Set());

  const memberIds = new Set((chat.members ?? []).map((m) => String(m.id ?? m._id)));

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    getFriends({ q: search || undefined, limit: 50 })
      .then((data) => {
        if (!isMounted) return;
        setFriends(Array.isArray(data) ? data : data?.friends || []);
      })
      .catch(() => {
        if (isMounted) setFriends([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    
    return () => {
      isMounted = false;
    };
  }, [search]);

  const eligible = friends.filter((f) => {
    const fid = String(f.id ?? f._id);
    return (
      !memberIds.has(fid) &&
      !added.has(fid) &&
      (f.displayName || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleAdd = async (f) => {
    const fid = String(f.id ?? f._id);
    try {
      await onAddMember?.(f);
      setAdded((prev) => new Set([...prev, fid]));
    } catch (err) {
      window.alert(err.message || "Failed to add member");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8d91]"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search friends..."
          className="w-full rounded-full border border-[#dddfe2] bg-[#f0f2f5] py-2 pl-9 pr-4 text-sm outline-none transition-colors focus:border-indigo-400 focus:bg-white"
        />
      </div>

      {/* List */}
      <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
        {loading ? (
          <p className="py-6 text-center text-sm text-[#8a8d91]">Loading friends...</p>
        ) : eligible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <svg className="h-8 w-8 text-[#ccd0d5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <p className="text-sm text-[#65676b]">
              {search ? `No friends match "${search}"` : "All friends are already in the group."}
            </p>
          </div>
        ) : (
          eligible.map((f) => (
            <div key={f.id ?? f._id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-[#f0f2f5]">
              {/* Clickable avatar + name → view profile */}
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => onViewProfile?.(f.id ?? f._id)}
              >
                <img
                  src={getAvatarUrl(f.avatarUrl)}
                  alt={f.displayName}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                  onError={(e) => { e.currentTarget.src = "/basic_avatar.jpg"; }}
                />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#1c1e21]">{f.displayName}</p>
              </button>
              <button
                type="button"
                className="shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-700"
                onClick={() => handleAdd(f)}
              >
                Add
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Edit Group Modal ─────────────────────────────────────── */
function EditGroupModal({ chat, currentUser, onClose, onUpdateGroup, onAddMember, onRemoveMember, onDelete, onLeave }) {
  const navigate = useNavigate();
  const [view, setView] = useState("edit"); // "edit" | "members" | "add-member"
  const [name, setName] = useState(chat.name || "");
  const [nameConfirm, setNameConfirm] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarConfirm, setAvatarConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const isOwner = !chat.ownerId || String(chat.ownerId) === String(currentUser?.id);
  const memberCount = chat.members?.length ?? chat.memberCount ?? "—";
  const displayAvatar = avatarPreview || getAvatarUrl(chat.profilePic, "group");

  useEffect(() => { setName(chat.name || ""); }, [chat.name]);

  useEffect(() => {
    const h = (e) => {
      if (e.key !== "Escape") return;
      if (view === "add-member") setView("members");
      else if (view === "members") setView("edit");
      else onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, onClose]);

  // ── Name ───────────────────────────────────────────────────
  const triggerNameConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === (chat.name || "").trim()) { setName(chat.name || ""); return; }
    setNameConfirm(true);
  };
  const confirmNameSave = async () => {
    try {
      await onUpdateGroup?.({ name: name.trim() });
      setNameConfirm(false);
    } catch (err) {
      window.alert(err.message || "Failed to update group");
    }
  };
  const cancelNameEdit = () => { setName(chat.name || ""); setNameConfirm(false); };

  // ── Avatar ─────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarConfirm(true);
  };
  const confirmAvatarSave = async () => {
    try {
      await onUpdateGroup?.({ avatar: avatarFile });
      setAvatarConfirm(false);
    } catch (err) {
      window.alert(err.message || "Failed to update group photo");
    }
  };
  const cancelAvatarEdit = () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); setAvatarPreview(null); setAvatarFile(null); setAvatarConfirm(false); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-[#f0f2f5] px-4 py-4">
          {view !== "edit" ? (
            <button
              type="button"
              onClick={() => setView(view === "add-member" ? "members" : "edit")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#65676b] transition hover:bg-[#f0f2f5]"
              aria-label="Back"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          ) : (
            <div className="h-7 w-7 shrink-0" />
          )}

          <h2 className="flex-1 text-center text-base font-bold text-[#1c1e21]">
            {view === "add-member" ? "Add Member" : view === "members" ? "Member List" : "Edit Group"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#65676b] transition hover:bg-[#f0f2f5]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────── */}
        <div className="px-5 py-5">
          {view === "add-member" ? (
            <AddMemberView
              chat={chat}
              onAddMember={onAddMember}
              onViewProfile={(userId) => { navigate(`/profile/${userId}`); onClose(); }}
            />
          ) : view === "members" ? (
            <MemberListView
              chat={chat}
              currentUser={currentUser}
              isOwner={isOwner}
              onAddMember={() => setView("add-member")}
              onRemoveMember={onRemoveMember}
              onViewProfile={(userId) => { navigate(`/profile/${userId}`); onClose(); }}
            />
          ) : (
            <div className="space-y-4">

              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <img src={displayAvatar} alt="Group avatar" className="h-20 w-20 rounded-full object-cover ring-2 ring-[#e4e6eb]" />
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md transition hover:bg-indigo-700"
                    aria-label="Change group photo">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} />
                </div>
                <p className="text-[11px] text-[#8a8d91]">Group photo</p>
                {avatarConfirm && (
                  <div className="flex w-full items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                    <p className="text-xs text-indigo-700">Use this photo?</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={cancelAvatarEdit} className="rounded-md px-2.5 py-1 text-xs font-semibold text-[#65676b] hover:bg-[#e4e6eb]">Cancel</button>
                      <button type="button" onClick={confirmAvatarSave} className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700">Confirm</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Group name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-[#65676b]">Group name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameConfirm(false); }}
                  onBlur={triggerNameConfirm}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                  placeholder="Group name"
                  maxLength={80}
                  className="rounded-lg border border-[#dddfe2] px-4 py-2.5 text-sm text-[#1c1e21] outline-none transition-colors focus:border-indigo-500"
                />
                {nameConfirm && (
                  <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                    <p className="text-xs text-indigo-700">Rename to <span className="font-semibold">"{name.trim()}"</span>?</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={cancelNameEdit} className="rounded-md px-2.5 py-1 text-xs font-semibold text-[#65676b] hover:bg-[#e4e6eb]">Cancel</button>
                      <button type="button" onClick={confirmNameSave} className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700">Save</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Members row — click ⋯ → navigate to member list */}
              <div className="flex items-center justify-between rounded-lg border border-[#e4e6eb] px-4 py-3">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-[#65676b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                  <span className="text-sm font-semibold text-[#1c1e21]">Members</span>
                  <span className="rounded-full bg-[#f0f2f5] px-2 py-0.5 text-xs font-semibold text-[#65676b]">{memberCount}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setView("members")}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#65676b] transition hover:bg-[#f0f2f5]"
                  aria-label="View member list"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 10a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z" />
                  </svg>
                </button>
              </div>

              {/* Danger zone */}
              <div className="rounded-lg border border-red-100 bg-red-50/50 px-4 py-3">
                {isOwner ? (
                  <button type="button" onClick={onDelete}
                    className="flex w-full items-center gap-2.5 text-sm font-semibold text-red-600 transition hover:text-red-700">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    Delete group chat
                  </button>
                ) : (
                  <button type="button" onClick={onLeave}
                    className="flex w-full items-center gap-2.5 text-sm font-semibold text-red-600 transition hover:text-red-700">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                    </svg>
                    Leave group
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Chat Header ──────────────────────────────────────────── */
export default function ChatHeader({ chat, currentUser, onCall, onOpenProfile, canOpenProfile = true, onUpdateGroup, onAddMember, onRemoveMember, onDeleteGroup, onLeaveGroup }) {
  const presence = getPresenceMeta(chat.presenceStatus);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const isGroup = chat.type === "group";

  const renderCallBtn = (onClick, label, children) => (
    <div className="group relative">
      <button type="button" id={`call-btn-${label.toLowerCase().replace(/\s/g, "-")}`} onClick={onClick} aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[#65676b] transition hover:bg-violet-50 hover:text-violet-600 active:scale-95">
        {children}
      </button>
      <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: "rgba(28,30,33,0.85)", zIndex: 10 }}>{label}</span>
    </div>
  );

  const avatarEl = (
    <span className="relative block h-10 w-10">
      <img src={getAvatarUrl(chat.profilePic, chat.type)} alt={chat.name} className="h-10 w-10 rounded-full object-cover" />
      {!isGroup && <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${presence.dotClassName}`} />}
    </span>
  );

  return (
    <>
      <header className="flex items-center justify-between border-b border-[#e4e6eb] bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          {isGroup ? (
            <button type="button" onClick={() => setEditGroupOpen(true)} className="rounded-full focus:outline-none" aria-label="Edit group">{avatarEl}</button>
          ) : canOpenProfile ? (
            <button type="button" onClick={onOpenProfile} className="rounded-full focus:outline-none" aria-label={`Open ${chat.name} profile`}>{avatarEl}</button>
          ) : avatarEl}
          <div>
            {isGroup ? (
              <button type="button" onClick={() => setEditGroupOpen(true)} className="font-semibold text-[#1c1e21] hover:underline">{chat.name}</button>
            ) : canOpenProfile ? (
              <button type="button" onClick={onOpenProfile} className="font-semibold text-[#1c1e21] hover:underline">{chat.name}</button>
            ) : (
              <p className="font-semibold text-[#1c1e21]">{chat.name}</p>
            )}
            <p className="text-xs text-[#65676b]">{isGroup ? "Group chat" : presence.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onCall?.voice && renderCallBtn(onCall.voice, "Voice call", (
            <svg className="h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          ))}
          {onCall?.video && renderCallBtn(onCall.video, "Video call", (
            <svg className="h-[18px] w-[18px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          ))}
        </div>
      </header>

      {editGroupOpen && (
        <EditGroupModal
          chat={chat}
          currentUser={currentUser}
          onClose={() => setEditGroupOpen(false)}
          onUpdateGroup={onUpdateGroup}
          onAddMember={onAddMember}
          onRemoveMember={onRemoveMember}
          onDelete={() => { setEditGroupOpen(false); onDeleteGroup?.(); }}
          onLeave={() => { setEditGroupOpen(false); onLeaveGroup?.(); }}
        />
      )}
    </>
  );
}
