import * as React from "react";

interface PasswordChangedEmailProps {
  userEmail: string;
  timestamp: string;
}

export const PasswordChangedEmail: React.FC<PasswordChangedEmailProps> = ({ userEmail, timestamp }) => {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ color: "#4F46E5", marginBottom: "20px" }}>Password Changed Successfully 🔐</h1>
      
      <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#374151" }}>
        Hi there,
      </p>
      
      <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#374151" }}>
        Your StackApply password was successfully changed on <strong>{timestamp}</strong>.
      </p>
      
      <div style={{ backgroundColor: "#FEF3C7", padding: "16px", borderRadius: "8px", margin: "24px 0", borderLeft: "4px solid #F59E0B" }}>
        <p style={{ color: "#92400E", margin: "0", fontSize: "14px", lineHeight: "1.6" }}>
          <strong>⚠️ If you didn't make this change:</strong><br />
          Please secure your account immediately by contacting our support team.
        </p>
      </div>
      
      <div style={{ backgroundColor: "#F3F4F6", padding: "16px", borderRadius: "8px", margin: "24px 0" }}>
        <h3 style={{ color: "#1F2937", fontSize: "14px", marginTop: "0", marginBottom: "8px" }}>Account Details:</h3>
        <p style={{ color: "#6B7280", margin: "0", fontSize: "14px" }}>
          <strong>Email:</strong> {userEmail}<br />
          <strong>Changed:</strong> {timestamp}
        </p>
      </div>
      
      <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#374151" }}>
        For your security, we recommend:
      </p>
      
      <ul style={{ color: "#374151", lineHeight: "1.8", fontSize: "14px" }}>
        <li>Using a unique password for each account</li>
        <li>Enabling two-factor authentication when available</li>
        <li>Avoiding sharing your password with anyone</li>
      </ul>
      
      <p style={{ fontSize: "14px", color: "#6B7280", marginTop: "32px", borderTop: "1px solid #E5E7EB", paddingTop: "20px" }}>
        If you have any questions or concerns, please don't hesitate to contact us.
      </p>
      
      <p style={{ fontSize: "14px", color: "#6B7280" }}>
        Best regards,<br />
        The StackApply Team
      </p>
    </div>
  );
};

export default PasswordChangedEmail;
