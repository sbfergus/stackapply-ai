import * as React from "react";

interface WelcomeEmailProps {
  userEmail: string;
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({ userEmail }) => {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ color: "#4F46E5", marginBottom: "20px" }}>Welcome to StackApply! 🎉</h1>
      
      <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#374151" }}>
        Hi there,
      </p>
      
      <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#374151" }}>
        Thanks for signing up! We're excited to help you streamline your job search and land your dream role.
      </p>
      
      <div style={{ backgroundColor: "#F3F4F6", padding: "20px", borderRadius: "8px", margin: "24px 0" }}>
        <h2 style={{ color: "#1F2937", fontSize: "18px", marginTop: "0" }}>AI-Powered Features</h2>
        <ul style={{ color: "#374151", lineHeight: "1.8" }}>
          <li>✨ <strong>Match Scoring:</strong> Upload your resume and get instant match scores for every job</li>
          <li>📄 <strong>Generate Tailored Resumes:</strong> Create job-specific resumes with one click</li>
          <li>🔖 <strong>Browser Extension:</strong> Save jobs from LinkedIn, Indeed, or any job site instantly</li>
          <li>📊 <strong>Pipeline Tracking:</strong> Organize jobs by stage and drag-and-drop to update</li>
        </ul>
      </div>
      
      <p style={{ fontSize: "16px", lineHeight: "1.6", color: "#374151" }}>
        Ready to get started? Upload your resume and let our AI help you land your dream job!
      </p>
      
      <a 
        href="https://stackapply-ai.vercel.app/dashboard" 
        style={{
          display: "inline-block",
          backgroundColor: "#4F46E5",
          color: "white",
          padding: "12px 24px",
          textDecoration: "none",
          borderRadius: "6px",
          fontWeight: "600",
          margin: "20px 0"
        }}
      >
        Go to Dashboard
      </a>
      
      <p style={{ fontSize: "14px", color: "#6B7280", marginTop: "32px", borderTop: "1px solid #E5E7EB", paddingTop: "20px" }}>
        If you have any questions, feel free to reply to this email. We're here to help!
      </p>
      
      <p style={{ fontSize: "14px", color: "#6B7280" }}>
        Best regards,<br />
        The StackApply Team
      </p>
    </div>
  );
};

export default WelcomeEmail;
