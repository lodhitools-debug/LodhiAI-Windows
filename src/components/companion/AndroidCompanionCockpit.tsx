import React, { useState, useEffect } from 'react';
import {
  generateCompanionPairingPin,
  listPairedDevices,
  revokePairedDevice,
  getCompanionSyncPayload,
  PairingSession,
  PairedDevice,
  CompanionSyncPayload,
} from '../../services/tauri';
import { logger } from '../../services/logger';

export const AndroidCompanionCockpit: React.FC = () => {
  const [pairingSession, setPairingSession] = useState<PairingSession | null>(null);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [syncPayload, setSyncPayload] = useState<CompanionSyncPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
    loadSyncStatus();
  }, []);

  useEffect(() => {
    if (!pairingSession) {
      setTimeLeft(0);
      return;
    }
    const update = () => {
      const remainingMs = pairingSession.expiresAtMs - Date.now();
      const secs = Math.max(0, Math.floor(remainingMs / 1000));
      setTimeLeft(secs);
      if (secs <= 0) {
        setPairingSession(null);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [pairingSession]);

  const loadDevices = async () => {
    try {
      const list = await listPairedDevices();
      setDevices(list);
    } catch (err) {
      logger.error('Failed to list paired companion devices', 'Companion', { error: String(err) });
    }
  };

  const loadSyncStatus = async () => {
    try {
      const payload = await getCompanionSyncPayload();
      setSyncPayload(payload);
    } catch (err) {
      logger.error('Failed to get sync payload', 'Companion', { error: String(err) });
    }
  };

  const handleGeneratePin = async () => {
    setLoading(true);
    try {
      const session = await generateCompanionPairingPin();
      setPairingSession(session);
      logger.info('Generated Android companion pairing PIN', 'Companion', {
        expiresAt: session.expiresAtMs,
      });
    } catch (err) {
      logger.error('Failed to generate pairing PIN', 'Companion', { error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    try {
      await revokePairedDevice(deviceId);
      setRevokeTarget(null);
      await loadDevices();
      logger.info('Revoked companion device authorization', 'Companion', { deviceId });
    } catch (err) {
      logger.error('Failed to revoke device', 'Companion', { deviceId, error: String(err) });
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview & Security Banner */}
      <div
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, color: '#f0f6fc', fontSize: '18px' }}>
                Android Companion Integration
              </h3>
              <span
                style={{
                  background: '#238636',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                Local LAN Encrypted Bridge
              </span>
            </div>
            <p style={{ margin: 0, color: '#8b949e', fontSize: '13px' }}>
              Pair your Android mobile phone to monitor agent tasks, authorize sensitive file writes, and sync conversations without cloud reliance.
            </p>
          </div>
          <button
            onClick={loadSyncStatus}
            style={{
              padding: '6px 14px',
              background: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Check Sync
          </button>
        </div>

        {/* Sync Status Metrics */}
        {syncPayload && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginTop: '16px',
            }}
          >
            <div style={{ background: '#161b22', padding: '12px', borderRadius: '8px', border: '1px solid #30363d' }}>
              <div style={{ color: '#8b949e', fontSize: '11px', textTransform: 'uppercase' }}>
                Gateway Status
              </div>
              <div style={{ color: '#3fb950', fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
                Online (Port 8443)
              </div>
              <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '2px' }}>
                mDNS LAN Discovery Active
              </div>
            </div>

            <div style={{ background: '#161b22', padding: '12px', borderRadius: '8px', border: '1px solid #30363d' }}>
              <div style={{ color: '#8b949e', fontSize: '11px', textTransform: 'uppercase' }}>
                Synced Tasks
              </div>
              <div style={{ color: '#58a6ff', fontSize: '15px', fontWeight: 600, marginTop: '4px' }}>
                {syncPayload.tasksCount} Active Checkpoints
              </div>
              <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '2px' }}>
                Conversations: {syncPayload.conversationsCount}
              </div>
            </div>

            <div style={{ background: '#161b22', padding: '12px', borderRadius: '8px', border: '1px solid #30363d' }}>
              <div style={{ color: '#8b949e', fontSize: '11px', textTransform: 'uppercase' }}>
                Offline Queue
              </div>
              <div style={{ color: '#d29922', fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
                {syncPayload.offlineQueueCount} Pending Replay
              </div>
              <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '2px' }}>
                Auto-retry with exponential backoff
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pairing Handshake Card */}
      <div
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', color: '#f0f6fc', fontSize: '15px' }}>
          Pair New Android Companion Device
        </h4>
        <p style={{ margin: '0 0 16px 0', color: '#8b949e', fontSize: '12px' }}>
          Generates a single-use 6-digit cryptographic pairing code valid for 5 minutes. Enter this code inside the Lodhi AI Android companion app.
        </p>

        {!pairingSession ? (
          <button
            onClick={handleGeneratePin}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: '#238636',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Generating...' : 'Generate 6-Digit Pairing PIN'}
          </button>
        ) : (
          <div
            style={{
              background: '#161b22',
              border: '1px solid #388bfd',
              borderRadius: '8px',
              padding: '16px',
              maxWidth: '400px',
            }}
          >
            <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '8px' }}>
              Enter this one-time code on your phone:
            </div>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                margin: '12px 0',
              }}
            >
              {pairingSession.pin.split('').map((digit, idx) => (
                <div
                  key={idx}
                  style={{
                    width: '38px',
                    height: '46px',
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#58a6ff',
                    fontSize: '22px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}
                >
                  {digit}
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '12px',
                fontSize: '12px',
              }}
            >
              <span style={{ color: timeLeft <= 60 ? '#f85149' : '#8b949e' }}>
                Expires in: <strong>{formatCountdown(timeLeft)}</strong>
              </span>
              <button
                onClick={() => setPairingSession(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8b949e',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Cancel PIN
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paired Devices List */}
      <div
        style={{
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, color: '#f0f6fc', fontSize: '15px' }}>
            Authorized Companion Devices ({devices.length})
          </h4>
          <button
            onClick={loadDevices}
            style={{
              padding: '4px 10px',
              background: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '6px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>

        {devices.length === 0 ? (
          <div
            style={{
              padding: '24px',
              background: '#161b22',
              borderRadius: '8px',
              color: '#8b949e',
              fontSize: '13px',
              textAlign: 'center',
            }}
          >
            No companion devices paired yet. Generate a pairing PIN above to link your Android phone.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {devices.map((dev) => (
              <div
                key={dev.id}
                style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#f0f6fc', fontSize: '14px', fontWeight: 600 }}>
                      {dev.name}
                    </span>
                    <span
                      style={{
                        background: '#238636',
                        color: '#ffffff',
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Authorized
                    </span>
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '4px' }}>
                    Model: {dev.model} | IP: {dev.ipAddress} | Paired: {new Date(dev.pairedAtMs).toLocaleDateString()}
                  </div>
                  <div style={{ color: '#58a6ff', fontSize: '11px', fontFamily: 'monospace', marginTop: '2px' }}>
                    Key Fingerprint: {dev.publicKeyFingerprint}
                  </div>
                </div>

                <button
                  onClick={() => setRevokeTarget(dev.id)}
                  style={{
                    padding: '6px 12px',
                    background: '#da3633',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Revoke Device
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revocation Confirmation Modal */}
      {revokeTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '420px',
              width: '90%',
            }}
          >
            <h4 style={{ margin: '0 0 12px 0', color: '#f85149', fontSize: '16px' }}>
              Confirm Device Revocation
            </h4>
            <p style={{ margin: '0 0 16px 0', color: '#c9d1d9', fontSize: '13px' }}>
              Are you sure you want to revoke authorization for device{' '}
              <strong style={{ color: '#f0f6fc' }}>{revokeTarget}</strong>? It will immediately lose access to task monitoring and conversation sync.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setRevokeTarget(null)}
                style={{
                  padding: '8px 14px',
                  background: '#21262d',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(revokeTarget)}
                style={{
                  padding: '8px 16px',
                  background: '#da3633',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Revoke Authorization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AndroidCompanionCockpit;
