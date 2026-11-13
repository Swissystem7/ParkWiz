function formatBatteryBypassStatus(voltage, isPlugged) {
	if (!isPlugged) {
		return {
			isOperational: false,
			statusText: "אין הזנת חשמל (מנותק)",
			warning: "POWER_DISCONNECTED",
		};
	}

	if (typeof voltage !== "number" || !Number.isFinite(voltage)) {
		return {
			isOperational: false,
			statusText: "מתח לא מאומת",
			warning: "INVALID_VOLTAGE",
		};
	}

	if (voltage < 3.95) {
		return {
			isOperational: false,
			statusText: `מתח נמוך (${voltage.toFixed(2)}V)`,
			warning: "UNDERVOLTAGE_BROWNOUT_RISK",
		};
	}

	if (voltage > 4.25) {
		return {
			isOperational: false,
			statusText: `מתח יתר (${voltage.toFixed(2)}V)`,
			warning: "OVERVOLTAGE_RISK",
		};
	}

	return {
		isOperational: true,
		statusText: `מתח תקין (${voltage.toFixed(2)}V)`,
		warning: null,
	};
}

module.exports = { formatBatteryBypassStatus };
