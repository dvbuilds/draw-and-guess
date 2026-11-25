import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  createGuestIdentity as createGuestIdentityApi,
  validateGuestIdentity as validateGuestIdentityApi,
} from '../services/playerService.js';
import {
  clearStoredPlayerIdentity,
  loadStoredPlayerIdentity,
  saveStoredPlayerIdentity,
} from '../utils/playerStorage.js';

export const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(null);
  const [identityToken, setIdentityToken] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [error, setError] = useState(null);

  const applyIdentity = useCallback((identity, restored = false) => {
    const nextPlayer = {
      playerId: identity.playerId,
      displayName: identity.displayName,
      roomId: identity.roomId,
    };
    setPlayer(nextPlayer);
    setIdentityToken(identity.identityToken);
    setRestoredFromStorage(restored);
    setError(null);
    saveStoredPlayerIdentity({ ...nextPlayer, identityToken: identity.identityToken });
  }, []);

  const clearIdentity = useCallback(() => {
    clearStoredPlayerIdentity();
    setPlayer(null);
    setIdentityToken(null);
    setRestoredFromStorage(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const restoreIdentity = useCallback(async () => {
    const stored = loadStoredPlayerIdentity();
    if (!stored) {
      setIsRestoring(false);
      return null;
    }

    setIsRestoring(true);
    setError(null);

    try {
      const result = await validateGuestIdentityApi({
        playerId: stored.playerId,
        identityToken: stored.identityToken,
      });

      if (result?.valid && result?.player) {
        const restoredIdentity = {
          ...result.player,
          identityToken: stored.identityToken,
        };
        applyIdentity(restoredIdentity, true);
        return restoredIdentity;
      }

      clearStoredPlayerIdentity();
      setPlayer(null);
      setIdentityToken(null);
      setRestoredFromStorage(false);
      setError({
        code: 'IDENTITY_EXPIRED',
        message: 'Previous guest session is no longer valid. Please enter a display name.',
      });
      return null;
    } catch (err) {
      if (err?.code === 'VALIDATION_ERROR') {
        clearStoredPlayerIdentity();
        setPlayer(null);
        setIdentityToken(null);
      } else {
        // Keep stored credentials if backend is temporarily unreachable so user can retry
        setPlayer({
          playerId: stored.playerId,
          displayName: stored.displayName,
          roomId: stored.roomId,
        });
        setIdentityToken(stored.identityToken);
        setRestoredFromStorage(true);
      }
      setError({
        code: err?.code || 'RESTORE_FAILED',
        message: err?.message || 'Unable to verify saved guest identity',
      });
      return null;
    } finally {
      setIsRestoring(false);
    }
  }, [applyIdentity]);

  useEffect(() => {
    restoreIdentity();
  }, [restoreIdentity]);

  const createIdentity = useCallback(
    async ({ displayName, roomId }) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const created = await createGuestIdentityApi({ displayName, roomId });
        applyIdentity(created, false);
        return created;
      } catch (err) {
        const normalized = {
          code: err?.code || 'CREATE_FAILED',
          message: err?.message || 'Unable to create guest identity',
        };
        setError(normalized);
        throw normalized;
      } finally {
        setIsSubmitting(false);
      }
    },
    [applyIdentity]
  );

  const revalidateCurrentIdentity = useCallback(async () => {
    if (!player?.playerId || !identityToken) return null;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await validateGuestIdentityApi({
        playerId: player.playerId,
        identityToken,
      });
      if (result?.valid && result?.player) {
        const verified = { ...result.player, identityToken };
        applyIdentity(verified, restoredFromStorage);
        return result;
      }
      clearStoredPlayerIdentity();
      setPlayer(null);
      setIdentityToken(null);
      setRestoredFromStorage(false);
      setError({
        code: 'IDENTITY_INVALID',
        message: 'Stored identity token failed validation.',
      });
      return result;
    } catch (err) {
      const normalized = {
        code: err?.code || 'VALIDATE_FAILED',
        message: err?.message || 'Failed to validate guest identity',
      };
      setError(normalized);
      throw normalized;
    } finally {
      setIsSubmitting(false);
    }
  }, [player, identityToken, applyIdentity, restoredFromStorage]);

  const value = useMemo(
    () => ({
      player,
      playerId: player?.playerId ?? null,
      displayName: player?.displayName ?? null,
      roomId: player?.roomId ?? null,
      identityToken,
      hasIdentity: Boolean(player?.playerId && identityToken),
      isRestoring,
      isSubmitting,
      restoredFromStorage,
      error,
      createIdentity,
      restoreIdentity,
      revalidateCurrentIdentity,
      clearIdentity,
      clearError,
    }),
    [
      player,
      identityToken,
      isRestoring,
      isSubmitting,
      restoredFromStorage,
      error,
      createIdentity,
      restoreIdentity,
      revalidateCurrentIdentity,
      clearIdentity,
      clearError,
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
