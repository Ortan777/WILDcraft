const SERVER_URL = 'http://10.10.10.100:3000';

export const registerUser = async (userId, name) => {
  try {
    const response = await fetch(`${SERVER_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name }),
    });
    return await response.json();
  } catch (e) {
    return { success: false };
  }
};

export const syncTransaction = async (transaction) => {
  try {
    const response = await fetch(`${SERVER_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    return await response.json();
  } catch (e) {
    return { success: false };
  }
};

export const getAmountReceived = async (userId) => {
  try {
    const response = await fetch(`${SERVER_URL}/received/${userId}`);
    return await response.json();
  } catch (e) {
    return { success: false, received: 0 };
  }
};