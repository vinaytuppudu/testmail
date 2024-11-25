import React, { useState } from 'react';
import axios from 'axios';

const Email = () => {
  const [emails, setEmails] = useState(''); // Store emails as a single string
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [downloadLink, setDownloadLink] = useState(null); // For the download link

  const handleValidateEmails = async () => {
    try {
      const emailArray = emails.split(',').map(email => email.trim()); // Convert input to array
      const response = await axios.post('http://localhost:5000/validateEmail', { emails: emailArray });

      // Assuming the response contains validEmails and failedEmails arrays
      const validEmails = response.data.validEmails || [];
      const failedEmails = response.data.failedEmails || [];

      // Set results in a format expected by the UI
      const formattedResults = [
        ...validEmails.map(email => ({ email, valid: true })),
        ...failedEmails.map(email => ({ email, valid: false, reason: 'Invalid' })),
      ];

      setResults(formattedResults); // Store results
      setDownloadLink(response.data.fileUrl); // Store download link
      setError(null);
    } catch (err) {
      setResults([]); // Reset results in case of error
      if (err.response) {
        setError(err.response.data.reason); // Set error message from the response
      } else {
        setError('An unexpected error occurred.'); // Generic error message
      }
    }
  };

  return (
    <div>
      <h1>Email Validator</h1>

      <textarea
        rows="5"
        placeholder="Enter emails separated by commas"
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
      />
      <button onClick={handleValidateEmails}>Validate Emails</button>

      {Array.isArray(results) && results.length > 0 && (
        <div>
          <h2>Validation Results:</h2>
          <ul>
            {results.map((result, index) => (
              <li key={index}>
                {result.email}: {result.valid ? 'Valid' : `Invalid - ${result.reason}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {downloadLink && (
        <button onClick={() => window.open(downloadLink, '_blank')}>
          Download Results
        </button>
      )}

      {error && (
        <div style={{ color: 'red' }}>
          <h2>Error:</h2>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default Email;
