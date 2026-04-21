import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import { v2 as cloudinary } from "cloudinary";

// =======================
// AUTH CONTROLLERS
// =======================

// Register User
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.json({ success: false, message: "Missing Details" });
        }

        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Invalid Email" });
        }

        if (password.length < 8) {
            return res.json({ success: false, message: "Password too short" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await userModel.create({
            name,
            email,
            password: hashedPassword
        });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

        res.json({ success: true, token });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Login User
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await userModel.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        res.json({ success: true, token });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// =======================
// PROFILE
// =======================

const getProfile = async (req, res) => {
    try {
        const { userId } = req.body;
        const userData = await userModel.findById(userId).select("-password");
        res.json({ success: true, userData });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { userId, name, phone, address, dob, gender } = req.body;
        const imageFile = req.file;

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Missing data" });
        }

        await userModel.findByIdAndUpdate(userId, {
            name,
            phone,
            address: JSON.parse(address),
            dob,
            gender
        });

        if (imageFile) {
            const upload = await cloudinary.uploader.upload(imageFile.path);
            await userModel.findByIdAndUpdate(userId, { image: upload.secure_url });
        }

        res.json({ success: true, message: "Profile updated" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// =======================
// APPOINTMENTS (NO PAYMENT)
// =======================

const bookAppointment = async (req, res) => {
    try {
        const { userId, docId, slotDate, slotTime } = req.body;

        const doctor = await doctorModel.findById(docId).select("-password");
        if (!doctor.available) {
            return res.json({ success: false, message: "Doctor unavailable" });
        }

        let slots_booked = doctor.slots_booked;

        if (slots_booked[slotDate]?.includes(slotTime)) {
            return res.json({ success: false, message: "Slot not available" });
        }

        slots_booked[slotDate] = slots_booked[slotDate] || [];
        slots_booked[slotDate].push(slotTime);

        const userData = await userModel.findById(userId).select("-password");
        delete doctor.slots_booked;

        const appointment = await appointmentModel.create({
            userId,
            docId,
            userData,
            docData: doctor,
            amount: doctor.fees,
            payment: true, // free appointment
            slotDate,
            slotTime,
            date: Date.now()
        });

        await doctorModel.findByIdAndUpdate(docId, { slots_booked });

        res.json({ success: true, message: "Appointment booked", appointment });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const cancelAppointment = async (req, res) => {
    try {
        const { userId, appointmentId } = req.body;

        const appointment = await appointmentModel.findById(appointmentId);
        if (appointment.userId.toString() !== userId) {
            return res.json({ success: false, message: "Unauthorized" });
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true });

        const doctor = await doctorModel.findById(appointment.docId);
        doctor.slots_booked[appointment.slotDate] =
            doctor.slots_booked[appointment.slotDate].filter(
                s => s !== appointment.slotTime
            );

        await doctorModel.findByIdAndUpdate(appointment.docId, {
            slots_booked: doctor.slots_booked
        });

        res.json({ success: true, message: "Appointment cancelled" });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const listAppointment = async (req, res) => {
    try {
        const { userId } = req.body;
        const appointments = await appointmentModel.find({ userId });
        res.json({ success: true, appointments });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// =======================
// EXPORTS
// =======================

export {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    bookAppointment,
    cancelAppointment,
    listAppointment
};
