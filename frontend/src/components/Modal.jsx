export function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;
  
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-lg w-full max-w-md p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <h2 className="text-lg font-semibold mb-4">{title}</h2>
          )}
  
          {children}
        </div>
      </div>
    );
  }
  