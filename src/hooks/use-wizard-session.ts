"use client";

import { useRef, useState } from "react";

// Данные для пошагового окна, которые подтягиваются в момент открытия. Мастер
// держит своё состояние, поэтому каждое открытие должно начинаться с чистого
// листа: sessionKey отдают в `key` мастера. Ответ на прошлое открытие не должен
// перезаписать данные нового.
export function useWizardSession<T>(fetchData: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const latestRequest = useRef(0);

  function start() {
    const request = ++latestRequest.current;
    setData(null);
    setSessionKey((count) => count + 1);
    void fetchData().then((loaded) => {
      if (request === latestRequest.current) setData(loaded);
    });
  }

  return { data, sessionKey, start };
}
