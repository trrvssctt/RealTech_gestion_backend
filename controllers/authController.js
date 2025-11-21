import bcrypt from 'bcryptjs';
import UserModel from '../models/userModel.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from '../config/jwt.js';

// Enregistrement (admin only)
export const registerUser = async (req, res) => {
  const { nom, prenom, email, telephone, role, password } = req.body;

  try {
    const existingUser = await UserModel.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Adapté au modèle MySQL
    const user = await UserModel.createUser({
      email,
      password_hash: hashedPassword,
      nom,
      prenom,
      telephone,
      role: role || 'employe',
    });

    // On ne retourne pas le hash
    const { password_hash, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user', details: error.message });
  }
};

// Connexion
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await UserModel.getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Prevent inactive users from logging in
    if (user.actif === false || user.actif === 0) {
      return res.status(403).json({ error: "Vous n'êtes pas autorisé à vous connecter" });
    }

    // PASSER l'objet user à generateAccessToken / generateRefreshToken
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Optionnel: renvoyer l'utilisateur sans hash
    const { password_hash, ...userWithoutPassword } = user;

    res.json({ accessToken, refreshToken, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login', details: error.message });
  }
};

// Refresh token
export const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await UserModel.getUserById(decoded.userId);

    if (!user) return res.status(401).json({ error: 'Invalid refresh token' });

    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// Profil
export const getProfile = async (req, res) => {
  const userId = req.user?.userId;

  try {
    const user = await UserModel.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // On ne retourne pas le hash
    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// Changer mot de passe
export const changePassword = async (req, res) => {
  const userId = req.user?.userId;
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await UserModel.getUserById(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await UserModel.updatePasswordHash(userId, hashedPassword);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
};

// Déconnexion
export const logout = async (req, res) => {
  // Ici tu peux gérer l’invalidation des refreshTokens si tu les stockes en DB
  res.json({ message: 'Logged out successfully' });
};