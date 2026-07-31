'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AgoraConsultationCall from '@/components/AgoraConsultationCall';

interface DoctorUser {
  id?: string;
  email?: string;
  fullName?: string;
  role?: string;
}

interface Consultation {
  _id: string;
  patientName: string;
  patientPhone?: string;
  appointmentDate: string;
  preferredTimeSlot?: string;
  allottedTime?: string;
  consultationType?: string;
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  queueNumber?: number;
}

interface DoctorResponse {
  doctorFound: boolean;
  message?: string;
  doctor?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    department: string;
    specialization: string;
    experience: number;
    qualification?: string;
    bio?: string;
    consultationFee?: number;
    availableDates?: string[];
    avatar?: string;
    isAvailable?: boolean;
  };
  stats?: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  consultations?: Consultation[];
}

export default function DoctorPanelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<DoctorUser | null>(null);
  const [doctorFound, setDoctorFound] = useState(true);
  const [doctorMessage, setDoctorMessage] = useState('');
  const [doctorProfile, setDoctorProfile] = useState<DoctorResponse['doctor']>();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | Consultation['status']>('all');
  const [searchText, setSearchText] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileImageUploading, setProfileImageUploading] = useState(false);
  const [profileImageError, setProfileImageError] = useState('');
  const [profileImagePreview, setProfileImagePreview] = useState('');
  const [localUserProfileImage, setLocalUserProfileImage] = useState('');
  const [newAvailableDate, setNewAvailableDate] = useState('');
  const [datesSaving, setDatesSaving] = useState(false);
  const [datesFeedback, setDatesFeedback] = useState('');
  const [timeUpdateError, setTimeUpdateError] = useState('');
  const [updatingTimeId, setUpdatingTimeId] = useState<string | null>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [exactTimeValue, setExactTimeValue] = useState('');
  const [activeCall, setActiveCall] = useState<Consultation | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    department: '',
    specialization: '',
    experience: 0,
    qualification: '',
    consultationFee: 0,
    availableDates: [] as string[],
    avatar: '👨‍⚕️',
    bio: '',
    isAvailable: true,
  });
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const rawUser = localStorage.getItem('user');

    if (!token || !rawUser) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(rawUser);
    if (parsedUser?.role !== 'doctor') {
      router.push('/');
      return;
    }

    setUser(parsedUser);
    setLocalUserProfileImage(parsedUser.profileImage || parsedUser.avatar || '');
    fetchDoctorPanelData(parsedUser.email);
  }, [router]);

  const fetchDoctorPanelData = async (email?: string) => {
    if (!email) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/doctor/consultations?email=${encodeURIComponent(email)}`, { cache: 'no-store' });
      const data: DoctorResponse = await res.json();

      setDoctorFound(data.doctorFound);
      setDoctorMessage(data.message || '');
      setDoctorProfile(data.doctor);
      if (data.doctor) {
        setProfileForm({
          name: data.doctor.name || '',
          phone: data.doctor.phone || '',
          department: data.doctor.department || '',
          specialization: data.doctor.specialization || '',
          experience: data.doctor.experience || 0,
          qualification: data.doctor.qualification || '',
          consultationFee: data.doctor.consultationFee || 0,
          availableDates: Array.isArray(data.doctor.availableDates) ? data.doctor.availableDates : [],
          avatar: data.doctor.avatar || '',
          bio: data.doctor.bio || '',
          isAvailable: data.doctor.isAvailable !== false,
        });
      }
      setConsultations(data.consultations || []);
      if (data.stats) setStats(data.stats);
    } catch (error) {
      console.error('Doctor panel error:', error);
    } finally {
      setLoading(false);
    }
  };

  const todayConsultations = useMemo(() => {
    const today = new Date();
    return consultations
      .filter((c) => {
      const d = new Date(c.appointmentDate);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
      })
      .sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));
  }, [consultations]);

  const upcomingConsultations = useMemo(() => {
    const now = new Date();
    return consultations
      .filter((c) => ['pending', 'confirmed', 'in-progress'].includes(c.status) && new Date(c.appointmentDate) >= now)
      .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
      .slice(0, 8);
  }, [consultations]);

  const visibleConsultations = useMemo(() => {
    return consultations.filter((c) => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const query = searchText.trim().toLowerCase();
      const matchesSearch =
        !query ||
        c.patientName.toLowerCase().includes(query) ||
        (c.patientPhone || '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [consultations, searchText, statusFilter]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const isImageUrl = (value?: string) =>
    !!value && /^(https?:\/\/|\/|data:image\/|blob:)/i.test(value);
  const dashboardAvatar =
    profileImagePreview || doctorProfile?.avatar || localUserProfileImage || profileForm.avatar || '';

  const uploadDoctorProfileImage = async (file?: File) => {
    if (!file) return;
    setProfileImageError('');

    if (!file.type.startsWith('image/')) {
      setProfileImageError('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileImageError('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setProfileImagePreview((e.target?.result as string) || '');
    reader.readAsDataURL(file);

    try {
      setProfileImageUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/doctor/upload-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      if (data.imageUrl) {
        setProfileForm((prev) => ({ ...prev, avatar: data.imageUrl }));
      }
    } catch (error: any) {
      setProfileImageError(error.message || 'Image upload failed');
    } finally {
      setProfileImageUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user?.email) return;
    setProfileSaving(true);
    setProfileError('');
    try {
      const rawUser = localStorage.getItem('user');
      const parsedUser = rawUser ? JSON.parse(rawUser) : null;
      const role = parsedUser?.role || 'doctor';

      const res = await fetch('/api/doctor/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role,
        },
        body: JSON.stringify({
          email: user.email,
          ...profileForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      const updated = data.doctor || {};
      setDoctorProfile((prev) => ({
        ...(prev as any),
        ...profileForm,
        ...updated,
        email: updated.email || user.email,
        consultationFee:
          typeof updated.consultationFee === 'number'
            ? updated.consultationFee
            : profileForm.consultationFee,
      }));
      setProfileForm((prev) => ({
        ...prev,
        consultationFee:
          typeof updated.consultationFee === 'number'
            ? updated.consultationFee
            : prev.consultationFee,
      }));
      setShowProfileModal(false);
    } catch (error: any) {
      setProfileError(error.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const toggleAvailability = async () => {
    if (!user?.email) return;
    setProfileSaving(true);
    setProfileError('');
    try {
      const rawUser = localStorage.getItem('user');
      const parsedUser = rawUser ? JSON.parse(rawUser) : null;
      const role = parsedUser?.role || 'doctor';

      const res = await fetch('/api/doctor/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role,
        },
        body: JSON.stringify({
          email: user.email,
          isAvailable: !profileForm.isAvailable,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update availability');

      setProfileForm((prev) => ({ ...prev, isAvailable: !prev.isAvailable }));
      setDoctorProfile((prev) => ({
        ...(prev as any),
        isAvailable: !profileForm.isAvailable,
      }));
    } catch (error: any) {
      setProfileError(error.message || 'Failed to update availability');
    } finally {
      setProfileSaving(false);
    }
  };

  const addAvailableDate = () => {
    if (!newAvailableDate) return;
    setDatesFeedback('');
    setProfileForm((prev) => ({
      ...prev,
      availableDates: Array.from(new Set([...(prev.availableDates || []), newAvailableDate])).sort(),
    }));
    setNewAvailableDate('');
  };

  const removeAvailableDate = (dateToRemove: string) => {
    setDatesFeedback('');
    setProfileForm((prev) => ({
      ...prev,
      availableDates: (prev.availableDates || []).filter((date) => date !== dateToRemove),
    }));
  };

  const saveAppointmentDates = async () => {
    if (!user?.email) return;

    setDatesSaving(true);
    setDatesFeedback('');

    try {
      const rawUser = localStorage.getItem('user');
      const parsedUser = rawUser ? JSON.parse(rawUser) : null;
      const role = parsedUser?.role || 'doctor';

      const res = await fetch('/api/doctor/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role,
        },
        body: JSON.stringify({
          email: user.email,
          availableDates: profileForm.availableDates,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save appointment dates');

      setDoctorProfile((prev) => ({
        ...(prev as any),
        availableDates: profileForm.availableDates,
      }));
      setDatesFeedback('Appointment dates saved successfully.');
    } catch (error: any) {
      setDatesFeedback(error.message || 'Failed to save appointment dates');
    } finally {
      setDatesSaving(false);
    }
  };

  const openTimeModal = (consultation: Consultation) => {
    setSelectedConsultation(consultation);
    setExactTimeValue(toTimeInputValue(consultation.allottedTime));
    setTimeUpdateError('');
    setShowTimeModal(true);
  };

  const closeTimeModal = () => {
    setShowTimeModal(false);
    setSelectedConsultation(null);
    setExactTimeValue('');
  };

  const saveExactTime = async () => {
    if (!selectedConsultation) return;

    if (!exactTimeValue) {
      setTimeUpdateError('Please select a valid exact time.');
      return;
    }

    if (!user?.email) {
      setTimeUpdateError('Doctor account email not found. Please log in again.');
      return;
    }

    setUpdatingTimeId(selectedConsultation._id);
    setTimeUpdateError('');

    try {
      const formattedTime = formatTimeForDisplay(exactTimeValue);
      const res = await fetch(`/api/doctor/consultations/${selectedConsultation._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-doctor-email': user.email,
        },
        body: JSON.stringify({
          allottedTime: formattedTime,
          status: 'confirmed',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update consultation time');
      }

      await fetchDoctorPanelData(user.email);
      closeTimeModal();
    } catch (error: any) {
      setTimeUpdateError(error.message || 'Failed to update consultation time');
    } finally {
      setUpdatingTimeId(null);
    }
  };

  const canJoinLiveCall = (consultation: Consultation) => {
    const type = consultation.consultationType || 'in-person';
    const isLiveMode = type === 'video' || type === 'audio';
    const isJoinableStatus = consultation.status === 'confirmed' || consultation.status === 'in-progress';
    return isLiveMode && isJoinableStatus;
  };

  const startLiveCall = async (consultation: Consultation) => {
    if (!canJoinLiveCall(consultation)) return;

    if (consultation.status === 'confirmed' && user?.email) {
      try {
        await fetch(`/api/doctor/consultations/${consultation._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-doctor-email': user.email,
          },
          body: JSON.stringify({ status: 'in-progress' }),
        });
      } catch {
        // Keep call startup resilient even if status update request fails.
      }
    }

    setActiveCall({ ...consultation, status: 'in-progress' });
    if (user?.email) {
      await fetchDoctorPanelData(user.email);
    }
  };

  const handleCallClose = async () => {
    const currentCall = activeCall;
    setActiveCall(null);

    if (!currentCall || currentCall.status === 'completed' || currentCall.status === 'cancelled') {
      return;
    }

    // Optimistically reflect call completion in current UI.
    setConsultations((prev) =>
      prev.map((item) =>
        item._id === currentCall._id ? { ...item, status: 'completed' } : item
      )
    );

    try {
      const res = await fetch(`/api/consultations/${currentCall._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to mark consultation completed');
      }
    } catch {
      // Keep close experience smooth even if status update fails temporarily.
    } finally {
      if (user?.email) {
        await fetchDoctorPanelData(user.email);
      }
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Doctor Workspace</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Clinical Dashboard</h1>
              <p className="text-slate-600 mt-1">Welcome {doctorProfile?.name || user?.fullName || 'Doctor'}</p>
              {doctorProfile && (
                <p className="text-sm text-slate-500 mt-2">
                  {doctorProfile.specialization} • {doctorProfile.department} • {doctorProfile.experience} yrs
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Today</p>
              <p className="text-sm font-semibold text-slate-900">{new Date().toLocaleDateString('en-GB')}</p>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700"
                >
                  Logout
                </button>
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-white font-medium hover:bg-emerald-700"
                >
                  My Profile
                </Link>
                <Link
                  href="/profile/support"
                  className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-white font-medium hover:bg-sky-700"
                >
                  Support Center
                </Link>
                <Link
                  href="/doctor/wallet"
                  className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
                >
                  My Wallet
                </Link>
                <button
                  type="button"
                  onClick={toggleAvailability}
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white ${profileForm.isAvailable ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  {profileForm.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
                </button>
                <Link
                  href="/doctor/prescriptions"
                  className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-white font-medium hover:bg-violet-700"
                >
                  📋 Prescriptions
                </Link>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-600">Loading doctor panel...</div>
        ) : !doctorFound ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-6">
            <h2 className="font-semibold text-lg">Doctor profile not linked</h2>
            <p className="text-sm mt-1">{doctorMessage || 'No doctor profile is mapped to this account email. Ask admin to create/update doctor profile with this email.'}</p>
            <p className="text-xs mt-2">Current account email: {user?.email || 'N/A'}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <StatCard title="Total Cases" value={stats.total} color="slate" />
              <StatCard title="Pending" value={stats.pending} color="amber" />
              <StatCard title="Confirmed" value={stats.confirmed} color="blue" />
              <StatCard title="Completed" value={stats.completed} color="emerald" />
              <StatCard title="Cancelled" value={stats.cancelled} color="red" />
            </div>

            <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center text-3xl">
                    {isImageUrl(dashboardAvatar) ? (
                      <img src={dashboardAvatar} alt={doctorProfile?.name || 'Doctor'} className="w-full h-full object-cover" />
                    ) : (
                      dashboardAvatar || '👨‍⚕️'
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">Account Profile</p>
                    <h2 className="text-xl font-bold text-slate-900 mt-1">{doctorProfile?.name}</h2>
                    <p className="text-sm text-slate-600">{doctorProfile?.email}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Who can edit profile: logged-in doctor (this account) and admin.
                    </p>
                    <p className="text-sm mt-2 text-slate-700">
                      Status:{' '}
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          doctorProfile?.isAvailable
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {doctorProfile?.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                <ProfileInfo label="Department" value={doctorProfile?.department} />
                <ProfileInfo label="Specialization" value={doctorProfile?.specialization} />
                <ProfileInfo label="Experience" value={`${doctorProfile?.experience || 0} years`} />
                <ProfileInfo label="Consultation Fee" value={formatFee(doctorProfile?.consultationFee)} />
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Appointment Dates</h2>
                  <p className="text-sm text-slate-500 mt-1">Set the dates patients can book from View Slots and booking form.</p>
                </div>
                <button
                  onClick={saveAppointmentDates}
                  disabled={datesSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {datesSaving ? 'Saving...' : 'Save Dates'}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={newAvailableDate}
                  onChange={(e) => setNewAvailableDate(e.target.value)}
                  placeholder="Select appointment date"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={addAvailableDate}
                  className="border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  Add Date
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(profileForm.availableDates || []).length === 0 ? (
                  <p className="text-xs text-slate-500">No appointment dates added yet.</p>
                ) : (
                  (profileForm.availableDates || []).map((date) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => removeAvailableDate(date)}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
                      title="Remove date"
                    >
                      {new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      x
                    </button>
                  ))
                )}
              </div>

              {datesFeedback && (
                <p className={`mt-3 text-sm ${datesFeedback.toLowerCase().includes('failed') ? 'text-red-600' : 'text-emerald-700'}`}>
                  {datesFeedback}
                </p>
              )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <section className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Today's Queue</h2>
                <p className="text-3xl font-bold text-slate-900">{todayConsultations.length}</p>
                <p className="text-sm text-slate-500 mb-4">consultation(s) scheduled today</p>

                {todayConsultations.length === 0 ? (
                  <p className="text-sm text-slate-500">No consultations scheduled for today.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-auto pr-1">
                    {todayConsultations.map((c) => (
                      <div key={c._id} className="border border-slate-200 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm text-slate-900 truncate">{c.patientName}</p>
                          <span className="text-xs text-slate-500">#{c.queueNumber || '-'}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{c.allottedTime || 'Awaiting exact time'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Upcoming Consultations</h2>
                {upcomingConsultations.length === 0 ? (
                  <p className="text-sm text-slate-500">No upcoming consultations.</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingConsultations.map((c) => (
                      <div key={c._id} className="border border-slate-200 rounded-xl p-3 flex flex-wrap justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{c.patientName}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(c.appointmentDate).toLocaleDateString()} • {c.allottedTime || 'Awaiting exact time'}
                          </p>
                          <p className="text-xs text-slate-500">Type: {c.consultationType || 'in-person'}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${statusClass(c.status)}`}>
                            {c.status}
                          </span>
                          {typeof c.queueNumber === 'number' && (
                            <p className="text-xs text-slate-500 mt-1">Queue #{c.queueNumber}</p>
                          )}
                          {canJoinLiveCall(c) && (
                            <button
                              onClick={() => startLiveCall(c)}
                              className="mt-2 block w-full rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              Join {c.consultationType === 'video' ? 'Video' : 'Audio'} Call
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="mt-6 bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-slate-900">All Consultations</h2>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search patient or phone"
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {timeUpdateError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {timeUpdateError}
                </div>
              )}

              {visibleConsultations.length === 0 ? (
                <p className="text-sm text-slate-500">No consultations match the current filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-190 text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-3 font-semibold">Patient</th>
                        <th className="py-2 pr-3 font-semibold">Date</th>
                        <th className="py-2 pr-3 font-semibold">Time</th>
                        <th className="py-2 pr-3 font-semibold">Type</th>
                        <th className="py-2 pr-3 font-semibold">Queue</th>
                        <th className="py-2 pr-3 font-semibold">Actions</th>
                        <th className="py-2 pr-0 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleConsultations.map((c) => (
                        <tr key={c._id} className="border-b border-slate-100 last:border-none">
                          <td className="py-3 pr-3">
                            <p className="font-medium text-slate-900">{c.patientName}</p>
                            <p className="text-xs text-slate-500">{c.patientPhone || '-'}</p>
                          </td>
                          <td className="py-3 pr-3 text-slate-700">{new Date(c.appointmentDate).toLocaleDateString()}</td>
                          <td className="py-3 pr-3 text-slate-700">{c.allottedTime || 'Awaiting doctor time'}</td>
                          <td className="py-3 pr-3 text-slate-700 capitalize">{c.consultationType || 'in-person'}</td>
                          <td className="py-3 pr-3 text-slate-700">#{c.queueNumber || '-'}</td>
                          <td className="py-3 pr-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => openTimeModal(c)}
                                disabled={updatingTimeId === c._id || c.status === 'cancelled' || c.status === 'completed'}
                                className="text-xs rounded-lg border border-blue-200 px-2.5 py-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {updatingTimeId === c._id ? 'Saving...' : (c.allottedTime ? 'Edit Time' : 'Set Exact Time')}
                              </button>

                              {canJoinLiveCall(c) && (
                                <button
                                  onClick={() => startLiveCall(c)}
                                  className="text-xs rounded-lg border border-emerald-200 px-2.5 py-1.5 text-emerald-700 hover:bg-emerald-50"
                                >
                                  Join {c.consultationType === 'video' ? 'Video' : 'Audio'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-0">
                            <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${statusClass(c.status)}`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {showTimeModal && selectedConsultation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200">
            <div className="bg-blue-600 text-white p-5 rounded-t-2xl flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Set Exact Consultation Time</h3>
                <p className="text-sm text-blue-100 mt-1">{selectedConsultation.patientName} • #{selectedConsultation.queueNumber || '-'}</p>
              </div>
              <button
                onClick={closeTimeModal}
                className="text-white/80 hover:text-white text-xl"
                disabled={updatingTimeId === selectedConsultation._id}
              >
                x
              </button>
            </div>

            <div className="p-5 space-y-4">
              {timeUpdateError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {timeUpdateError}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Appointment Date: {new Date(selectedConsultation.appointmentDate).toLocaleDateString()}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Exact Time</label>
                <input
                  type="time"
                  value={exactTimeValue}
                  onChange={(e) => setExactTimeValue(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-slate-500 mt-1">Patient sees this time as confirmed by doctor.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={closeTimeModal}
                  disabled={updatingTimeId === selectedConsultation._id}
                  className="flex-1 border border-slate-300 text-slate-700 rounded-lg py-2.5 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={saveExactTime}
                  disabled={updatingTimeId === selectedConsultation._id}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
                >
                  {updatingTimeId === selectedConsultation._id ? 'Saving...' : 'Confirm Time'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-linear-to-r from-slate-900 to-slate-700 text-white p-5 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Edit Account Profile</h3>
                <p className="text-xs text-slate-200 mt-1">Professional details visible on doctor panel</p>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="text-white/80 hover:text-white text-xl">x</button>
            </div>

            <div className="p-5 space-y-4">
              {profileError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{profileError}</div>
              )}

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <p className="text-sm font-medium text-slate-800 mb-2">Profile Image</p>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center text-2xl">
                    {profileImagePreview ? (
                      <img src={profileImagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : isImageUrl(profileForm.avatar) ? (
                      <img src={profileForm.avatar} alt="Doctor profile" className="w-full h-full object-cover" />
                    ) : (
                      profileForm.avatar || '👨‍⚕️'
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadDoctorProfileImage(e.target.files?.[0])}
                      disabled={profileImageUploading}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 disabled:opacity-50"
                    />
                    <p className="text-xs text-slate-500 mt-1">Upload image to Cloudinary first, then URL will be stored in profile.</p>
                    {profileImageUploading && <p className="text-xs text-blue-600 mt-1">Uploading image...</p>}
                    {profileImageError && <p className="text-xs text-red-600 mt-1">{profileImageError}</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Full Name" value={profileForm.name} onChange={(v) => setProfileForm({ ...profileForm, name: v })} />
                <InputField label="Phone" value={profileForm.phone} onChange={(v) => setProfileForm({ ...profileForm, phone: v })} />
                <InputField label="Department" value={profileForm.department} onChange={(v) => setProfileForm({ ...profileForm, department: v })} />
                <InputField label="Specialization" value={profileForm.specialization} onChange={(v) => setProfileForm({ ...profileForm, specialization: v })} />
                <InputField label="Experience (years)" type="number" value={String(profileForm.experience)} onChange={(v) => setProfileForm({ ...profileForm, experience: Number(v) || 0 })} />
                <InputField label="Qualification" value={profileForm.qualification} onChange={(v) => setProfileForm({ ...profileForm, qualification: v })} />
                <InputField label="Consultation Fee (INR)" type="number" value={String(profileForm.consultationFee)} onChange={(v) => setProfileForm({ ...profileForm, consultationFee: Number(v) || 0 })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Short professional summary"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={profileForm.isAvailable}
                  onChange={(e) => setProfileForm({ ...profileForm, isAvailable: e.target.checked })}
                  className="accent-emerald-600"
                />
                Available for new consultations
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowProfileModal(false)} className="flex-1 border border-slate-300 text-slate-700 rounded-lg py-2.5 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={saveProfile} disabled={profileSaving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2.5 font-medium disabled:opacity-60">
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeCall && (
        <AgoraConsultationCall
          isOpen={!!activeCall}
          consultationId={activeCall._id}
          consultationType={activeCall.consultationType === 'video' ? 'video' : 'audio'}
          participantType="doctor"
          participantLabel="Doctor"
          onClose={handleCallClose}
        />
      )}
    </div>
  );
}

function ProfileInfo({ label, value }: { label: string; value?: string }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value || '-'}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
      />
    </div>
  );
}

function formatFee(fee?: number) {
  const amount = Number(fee || 0);
  if (amount <= 0) return 'Free';

  // For doctor panel, assume INR since it's for Indian doctors
  return amount <= 0 ? 'Free' : `₹${amount}`;
}

function formatTimeForDisplay(value: string) {
  const [hRaw, mRaw] = value.split(':');
  const hours = Number(hRaw);
  const minutes = Number(mRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const minuteText = String(minutes).padStart(2, '0');
  return `${hour12}:${minuteText} ${period}`;
}

function toTimeInputValue(displayTime?: string) {
  if (!displayTime) return '';

  const simpleMatch = displayTime.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (simpleMatch) {
    let hour = Number(simpleMatch[1]);
    const minute = Number(simpleMatch[2]);
    const period = simpleMatch[3].toUpperCase();

    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  if (/^\d{2}:\d{2}$/.test(displayTime)) {
    return displayTime;
  }

  return '';
}

function statusClass(status: Consultation['status']) {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
  if (status === 'confirmed') return 'bg-blue-100 text-blue-700';
  if (status === 'in-progress') return 'bg-purple-100 text-purple-700';
  if (status === 'cancelled') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

function StatCard({ title, value, color }: { title: string; value: number; color: 'slate' | 'amber' | 'blue' | 'emerald' | 'red' }) {
  const colors: Record<string, string> = {
    slate: 'text-slate-800 bg-slate-100',
    amber: 'text-amber-800 bg-amber-100',
    blue: 'text-blue-800 bg-blue-100',
    emerald: 'text-emerald-800 bg-emerald-100',
    red: 'text-red-800 bg-red-100',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{title}</p>
      <div className="flex items-center justify-between">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <span className={`h-3 w-3 rounded-full ${colors[color].split(' ')[1]}`} />
      </div>
    </div>
  );
}
