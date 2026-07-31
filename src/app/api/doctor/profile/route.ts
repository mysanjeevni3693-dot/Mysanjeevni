import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Doctor } from '@/lib/models/Doctor';

// GET /api/doctor/profile?userId=xxx or ?doctorId=xxx
// Fetches the doctor profile
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Try to get userId or doctorId from query parameters
    let userId = request.nextUrl.searchParams.get('userId');
    const doctorId = request.nextUrl.searchParams.get('doctorId');
    
    // If userId is provided, fetch by userId
    if (userId) {
      const doctor = await Doctor.findOne({ userId }).lean();
      
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor profile not found. Please complete your profile setup.' }, { status: 404 });
      }

      return NextResponse.json({ message: 'Doctor profile fetched successfully', doctor });
    }
    
    // If doctorId is provided, fetch by _id
    if (doctorId) {
      const doctor = await Doctor.findById(doctorId).lean();
      
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });
      }

      return NextResponse.json({ message: 'Doctor profile fetched successfully', doctor });
    }

    // If neither is provided, try to get from Authorization header (for future JWT support)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // For now, we can't verify random UUID tokens, so we'll just return an error
      // In the future, this can be enhanced with JWT support
      return NextResponse.json({ error: 'Please provide userId or doctorId as query parameters' }, { status: 400 });
    }

    return NextResponse.json({ error: 'User ID or Doctor ID is required' }, { status: 400 });
  } catch (error: any) {
    console.error('Doctor profile fetch error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/doctor/profile
// Body: { email, name, phone, department, specialization, experience, qualification, bio, consultationFee, avatar, isAvailable }
export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    const actorRole = request.headers.get('x-user-role');
    if (actorRole !== 'doctor' && actorRole !== 'admin') {
      return NextResponse.json({ error: 'Only doctor or admin can edit profile' }, { status: 403 });
    }

    const body = await request.json();
    const {
      email,
      name,
      phone,
      department,
      specialization,
      experience,
      qualification,
      bio,
      consultationFee,
      availableDates,
      avatar,
      isAvailable,
    } = body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (department !== undefined) updates.department = department;
    if (specialization !== undefined) updates.specialization = specialization;
    if (experience !== undefined) updates.experience = Number(experience) || 0;
    if (qualification !== undefined) updates.qualification = qualification;
    if (bio !== undefined) updates.bio = bio;
    if (consultationFee !== undefined && consultationFee !== null && consultationFee !== '') {
      const fee = Number(consultationFee);
      if (!Number.isFinite(fee) || fee < 0) {
        return NextResponse.json({ error: 'Consultation fee must be a valid non-negative number' }, { status: 400 });
      }
      updates.consultationFee = fee;
    }
    if (availableDates !== undefined && Array.isArray(availableDates)) {
      updates.availableDates = Array.from(
        new Set(
          availableDates
            .map((date) => String(date || '').trim())
            .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        )
      ).sort();
    }
    if (avatar !== undefined) updates.avatar = avatar;
    if (isAvailable !== undefined) updates.isAvailable = !!isAvailable;

    const doctor = await Doctor.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: updates },
      { new: true }
    ).lean();

    // Fallback for legacy rows stored with different email casing
    let resolvedDoctor = doctor;
    if (!resolvedDoctor) {
      resolvedDoctor = await Doctor.findOneAndUpdate(
        { email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { $set: { ...updates, email: normalizedEmail } },
        { new: true }
      ).lean();
    }

    if (!resolvedDoctor) {
      return NextResponse.json({ error: 'Doctor profile not found for this email' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Profile updated successfully', doctor: resolvedDoctor });
  } catch (error: any) {
    console.error('Doctor profile update error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
