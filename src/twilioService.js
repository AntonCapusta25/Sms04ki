export const sendSMS = async (to, message) => {
  try {
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, message }),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        sid: data.sid,
        message: 'SMS sent successfully',
      };
    } else {
      return {
        success: false,
        error: data.error || 'Failed to send SMS',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
};
