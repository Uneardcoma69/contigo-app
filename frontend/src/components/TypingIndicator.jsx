export default function TypingIndicator() {
  return (
    <div className="chat-bubble-row">
      <img
        src="/contigo-bot.jpeg"
        alt="Contigo"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid var(--teal-light)',
          flexShrink: 0
        }}
      />
      <div className="typing-indicator" aria-label="Contigo está escribiendo...">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  )
}
