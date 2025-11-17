import { useCallback, useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import type { Socket } from "socket.io-client";
import type {
  WhiteboardClearAck,
  WhiteboardPoint,
  WhiteboardStroke,
  WhiteboardStrokeAck,
  WhiteboardStrokePayload,
  WhiteboardToggleAck,
  WhiteboardTogglePayload,
  WhiteboardStateSnapshot,
  WhiteboardTool,
} from "@skylive/shared";

interface UseWhiteboardOptions {
  socket?: Socket | null;
  roomId?: string;
  participantId?: string;
  canAnnotate: boolean;
  isHost: boolean;
}

interface UseWhiteboardResult {
  state: WhiteboardStateSnapshot | null;
  isActive: boolean;
  canAnnotate: boolean;
  tool: WhiteboardTool;
  color: string;
  size: number;
  setTool: (tool: WhiteboardTool) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  toggle: (nextState?: boolean) => Promise<WhiteboardToggleAck | undefined>;
  sendStroke: (points: WhiteboardPoint[]) => void;
  clear: () => Promise<WhiteboardClearAck | undefined>;
}

export const WHITEBOARD_COLORS = ["#FFE066", "#51E3D4", "#FF6B6B", "#9381FF", "#A9FBD7", "#F4AC45"] as const;
export const WHITEBOARD_DEFAULT_SIZE = 4;
const MAX_POINTS = 1024;

export function useWhiteboard({ socket, roomId, participantId, canAnnotate, isHost }: UseWhiteboardOptions): UseWhiteboardResult {
  const [state, setState] = useState<WhiteboardStateSnapshot | null>(null);
  const [tool, setTool] = useState<WhiteboardTool>("pen");
  const [color, setColor] = useState<string>(WHITEBOARD_COLORS[2]);
  const [size, setSize] = useState<number>(WHITEBOARD_DEFAULT_SIZE);

  useEffect(() => {
    if (!socket || !roomId) {
      return undefined;
    }

    socket.emit("whiteboard:sync", (ack: WhiteboardToggleAck | undefined) => {
      if (ack?.state) {
        setState(ack.state);
      }
    });

    const handleToggle = (payload: { state?: WhiteboardStateSnapshot } | undefined) => {
      if (!payload?.state) {
        return;
      }
      setState(payload.state);
    };

    const handleStroke = (event: { stroke: WhiteboardStroke; revision: number }) => {
      setState((prev) => {
        if (!prev) {
          return prev;
        }
        const nextStrokes = prev.strokes.concat(event.stroke).slice(-MAX_POINTS);
        return { ...prev, strokes: nextStrokes, revision: event.revision, updatedAt: new Date().toISOString() };
      });
    };

    const handleClear = (event: { revision: number }) => {
      setState((prev) => {
        if (!prev) {
          return prev;
        }
        return { ...prev, strokes: [], revision: event.revision, updatedAt: new Date().toISOString() };
      });
    };

    socket.on("whiteboard:toggle", handleToggle);
    socket.on("whiteboard:stroke", handleStroke);
    socket.on("whiteboard:clear", handleClear);

    return () => {
      socket.off("whiteboard:toggle", handleToggle);
      socket.off("whiteboard:stroke", handleStroke);
      socket.off("whiteboard:clear", handleClear);
    };
  }, [roomId, socket]);

  const toggle = useCallback(
    async (nextState?: boolean) => {
      if (!socket || !roomId || !participantId) {
        return undefined;
      }

      const desiredState = typeof nextState === "boolean" ? nextState : !Boolean(state?.active);
      const payload: WhiteboardTogglePayload = { roomId, active: desiredState, userId: participantId };

      return new Promise<WhiteboardToggleAck | undefined>((resolve) => {
        socket.emit("whiteboard:toggle", payload, (ack: WhiteboardToggleAck) => {
          if (ack?.state) {
            setState(ack.state);
          }
          resolve(ack);
        });
      });
    },
    [participantId, roomId, socket, state?.active],
  );

  const sendStroke = useCallback(
    (points: WhiteboardPoint[]) => {
      if (!socket || !roomId || !state || !canAnnotate || points.length === 0) {
        return;
      }

      const stroke: WhiteboardStroke = {
        id: nanoid(),
        roomId,
        userId: participantId ?? "anonymous",
        tool,
        color,
        size,
        points,
        createdAt: new Date().toISOString(),
      };

      const payload: WhiteboardStrokePayload = {
        roomId,
        stroke,
      };

      setState((prev) => {
        if (!prev) {
          return prev;
        }
        const nextStrokes = prev.strokes.concat(stroke).slice(-MAX_POINTS);
        return { ...prev, strokes: nextStrokes, revision: prev.revision + 1 };
      });

      socket.emit("whiteboard:stroke", payload, (ack: WhiteboardStrokeAck) => {
        if (ack?.ok && typeof ack.revision === "number") {
          const revision = ack.revision;
          setState((prev) => (prev ? { ...prev, revision } : prev));
          return;
        }
        setState((prev) => {
          if (!prev) {
            return prev;
          }
          const filtered = prev.strokes.filter((existing) => existing.id !== stroke.id);
          return { ...prev, strokes: filtered };
        });
      });
    },
    [canAnnotate, color, participantId, roomId, socket, state, tool, size],
  );

  const clear = useCallback(async () => {
    if (!socket || !roomId || !isHost) {
      return undefined;
    }

    return new Promise<WhiteboardClearAck | undefined>((resolve) => {
      socket.emit("whiteboard:clear", { roomId }, (ack: WhiteboardClearAck) => {
        if (ack?.ok && typeof ack.revision === "number") {
          const revision = ack.revision;
          setState((prev) => (prev ? { ...prev, strokes: [], revision } : prev));
        }
        resolve(ack);
      });
    });
  }, [isHost, roomId, socket]);

  const derivedState = useMemo(() => ({
    state,
    isActive: Boolean(state?.active),
    canAnnotate,
    tool,
    color,
    size,
  }), [state, canAnnotate, tool, color, size]);

  return {
    ...derivedState,
    setTool,
    setColor,
    setSize,
    toggle,
    sendStroke,
    clear,
  };
}
