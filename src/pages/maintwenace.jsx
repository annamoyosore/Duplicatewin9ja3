import React from "react";

export default function Maintenance() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        
        {/* Icon */}
        <div style={styles.icon}>🛠️</div>

        {/* Title */}
        <h1 style={styles.title}>Under Maintenance</h1>

        {/* Message */}
        <p style={styles.text}>
          We’re currently improving your experience.
          <br />
          Please check back shortly.
        </p>

        {/* Optional Info */}
        <p style={styles.subtext}>
          Thank you for your patience 🙏
        </p>

        {/* Loader */}
        <div style={styles.loader}></div>

      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    width: "100%",
    background: "linear-gradient(135deg, #0f172a, #020617)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "sans-serif"
  },

  card: {
    background: "#020617",
    padding: "40px",
    borderRadius: "16px",
    textAlign: "center",
    boxShadow: "0 0 40px rgba(255, 215, 0, 0.15)",
    border: "1px solid rgba(255,215,0,0.2)",
    maxWidth: "350px",
    width: "90%"
  },

  icon: {
    fontSize: "50px",
    marginBottom: "10px"
  },

  title: {
    color: "gold",
    marginBottom: "10px"
  },

  text: {
    color: "#ddd",
    fontSize: "14px",
    lineHeight: "1.5"
  },

  subtext: {
    color: "#888",
    marginTop: "10px",
    fontSize: "12px"
  },

  loader: {
    margin: "20px auto 0",
    width: "40px",
    height: "40px",
    border: "4px solid #333",
    borderTop: "4px solid gold",
    borderRadius: "50%",
    animation: "spin 1s linear infinite"
  }
};

// 🔁 Add this globally (e.g. index.css)