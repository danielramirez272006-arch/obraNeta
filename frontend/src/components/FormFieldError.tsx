import React from 'react';

interface FormFieldErrorProps {
  error?: string;
  id?: string;
}

export const FormFieldError: React.FC<FormFieldErrorProps> = ({ error, id }) => {
  if (!error) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {error}
    </p>
  );
};

