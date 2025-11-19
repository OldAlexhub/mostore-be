import ChatSession from '../models/ChatSession.js';
import OrderModel from '../models/Orders.js';
import { emitToAdmins, emitToSession } from '../socket/socketState.js';

const normalizePhone = (value = '') => String(value).replace(/\D/g, '');

const formatSession = (sessionDoc) => {
  if (!sessionDoc) return null;
  const session = sessionDoc.toObject ? sessionDoc.toObject() : sessionDoc;
  return {
    _id: session._id,
    customerName: session.customerName,
    customerPhone: session.customerPhone,
    orderNumber: session.orderNumber,
    orderId: session.orderId,
    status: session.status,
    closedAt: session.closedAt,
    createdAt: session.createdAt,
    lastMessageAt: session.lastMessageAt,
    startedAsGuest: session.startedAsGuest,
    messages: session.messages || []
  };
};

const sessionSummary = (sessionDoc) => {
  if (!sessionDoc) return null;
  const session = sessionDoc.toObject ? sessionDoc.toObject() : sessionDoc;
  const lastMessage = Array.isArray(session.messages) && session.messages.length
    ? session.messages[session.messages.length - 1]
    : null;
  return {
    _id: session._id,
    customerName: session.customerName,
    customerPhone: session.customerPhone,
    orderNumber: session.orderNumber,
    orderId: session.orderId,
    status: session.status,
    lastMessageAt: session.lastMessageAt,
    closedAt: session.closedAt,
    messagesCount: Array.isArray(session.messages) ? session.messages.length : 0,
    startedAsGuest: !!session.startedAsGuest,
    lastSender: lastMessage?.sender || null,
    lastText: lastMessage?.text || ''
  };
};

const closeSessionById = async ({ sessionId, closedBy }) => {
  const now = new Date();
  const session = await ChatSession.findOneAndUpdate(
    { _id: sessionId, status: 'open' },
    { $set: { status: 'closed', closedAt: now, lastMessageAt: now } },
    { new: true }
  );
  if (!session) return null;
  if (closedBy) {
    session.messages.push({
      sender: 'system',
      text: `${closedBy} أغلق المحادثة`,
      createdAt: now
    });
    await session.save();
  }
  emitToSession(sessionId, 'chat:sessionClosed', { sessionId });
  emitToAdmins('chat:sessionClosed', { sessionId });
  emitToAdmins('chat:sessionUpdated', sessionSummary(session));
  return session;
};

export const startChat = async (req, res) => {
  try {
    const { phoneNumber, name } = req.body || {};
    const phone = normalizePhone(phoneNumber);
    if (!phone) {
      return res.status(400).json({ error: 'الرجاء إدخال رقم الهاتف' });
    }

    const existing = await ChatSession.findOne({ customerPhone: phone, status: 'open' });
    if (existing) {
      return res.json({ session: formatSession(existing) });
    }

    const order = await OrderModel.findOne({ 'userDetails.phoneNumber': phone }).sort({ createdAt: -1 });
    if (!order && !name) {
      return res.status(400).json({
        error: 'لم يتم العثور على طلب. الرجاء إدخال الاسم لمتابعة الدردشة.',
        requiresName: true
      });
    }

    const customerName = (name && String(name).trim()) || order?.userDetails?.username || 'عميل';

    const session = await ChatSession.create({
      customerPhone: phone,
      customerName,
      orderNumber: order?.orderNumber || null,
      orderId: order?._id || null,
      status: 'open',
      startedAsGuest: !order,
      messages: []
    });

    emitToAdmins('chat:sessionUpdated', sessionSummary(session));

    return res.status(201).json({ session: formatSession(session) });
  } catch (err) {
    console.error('[chat] startChat error', err);
    return res.status(500).json({ error: 'تعذر بدء الدردشة' });
  }
};

export const getSessionPublic = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await ChatSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'المحادثة غير موجودة' });
    return res.json({ session: formatSession(session) });
  } catch (err) {
    console.error('[chat] getSessionPublic error', err);
    return res.status(500).json({ error: 'تعذر جلب المحادثة' });
  }
};

export const closeSessionPublic = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { by } = req.body || {};
    const session = await closeSessionById({ sessionId, closedBy: by || 'العميل' });
    if (!session) return res.status(404).json({ error: 'المحادثة غير موجودة أو مغلقة' });
    return res.json({ session: formatSession(session) });
  } catch (err) {
    console.error('[chat] closeSessionPublic error', err);
    return res.status(500).json({ error: 'تعذر إغلاق المحادثة' });
  }
};

export const listSessions = async (req, res) => {
  try {
    const { status = 'open', limit = 50 } = req.query;
    const filter = status === 'all' ? {} : { status };
    const sessions = await ChatSession.find(filter)
      .sort({ status: 1, lastMessageAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200));
    return res.json({ sessions: sessions.map(sessionSummary) });
  } catch (err) {
    console.error('[chat] listSessions error', err);
    return res.status(500).json({ error: 'تعذر جلب المحادثات' });
  }
};

export const getSessionAdmin = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await ChatSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'المحادثة غير موجودة' });
    return res.json({ session: formatSession(session) });
  } catch (err) {
    console.error('[chat] getSessionAdmin error', err);
    return res.status(500).json({ error: 'تعذر جلب المحادثة' });
  }
};

export const adminCloseSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const name = req.user?.username || 'المسؤول';
    const session = await closeSessionById({ sessionId, closedBy: name });
    if (!session) return res.status(404).json({ error: 'المحادثة غير موجودة أو مغلقة' });
    return res.json({ session: formatSession(session) });
  } catch (err) {
    console.error('[chat] adminCloseSession error', err);
    return res.status(500).json({ error: 'تعذر إغلاق المحادثة' });
  }
};
