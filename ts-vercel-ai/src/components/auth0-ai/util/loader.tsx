interface WaitingMessageProps {
  remainingSeconds?: number;
  onCancel?: () => void;
}

export const WaitingMessage = ({ remainingSeconds, onCancel }: WaitingMessageProps) => {
  const countdownText =
    remainingSeconds !== undefined && remainingSeconds > 0
      ? ` (Auto-timeout in ${remainingSeconds}s)`
      : '';

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-col gap-2 text-muted-foreground">
        <span>Waiting for you to authorize in the popup window...{countdownText}</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2 self-start transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
