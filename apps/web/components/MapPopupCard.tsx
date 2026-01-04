"use client";

import { useEffect, useState } from "react";
import styles from "./MapPopupCard.module.css";

type MapPopupCardProps = {
  title: string;
  price: string;
  secondaryText?: string;
  onBook: () => void;
};

export function MapPopupCard({ title, price, secondaryText, onBook }: MapPopupCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={`${styles.card} ${visible ? styles.cardVisible : ""}`}>
      <div className={styles.topRow}>
        <div className={styles.title} title={title}>
          {title}
        </div>
        <div className={styles.price}>{price}</div>
      </div>
      {secondaryText ? <div className={styles.secondary}>{secondaryText}</div> : null}
      <div className={styles.cta}>
        <button className={styles.button} onClick={onBook} type="button">
          Book
        </button>
      </div>
    </div>
  );
}
