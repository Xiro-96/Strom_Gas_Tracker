import { useState, type ChangeEvent } from 'react';

type Changeable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Kleiner Formularzustand für die Inline-Formulare der Detailseite (Strings, wie eingegeben). */
export function useDraft<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState(initial);
  const bind = (name: keyof T & string) => ({
    name,
    value: values[name],
    onChange: (event: ChangeEvent<Changeable>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [name]: value }));
    },
  });
  return { values, bind };
}
