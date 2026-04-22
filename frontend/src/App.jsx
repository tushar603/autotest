import React, { useState } from 'react';
import axios from 'axios';
import { Container, Row, Col, Form, Button, Card, Spinner, Badge, Table } from 'react-bootstrap';

function App() {
  const [prdText, setPrdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!prdText.trim()) return;
    
    setLoading(true);
    setError(null);
    setResults(null);
    setProvider(null);

    try {
      // Send the PRD to your FastAPI backend
      const response = await axios.post('https://autotest-9n29.onrender.com/', {
        text: prdText
      });

      setResults(response.data.data);
      setProvider(response.data.provider);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to connect to TestForge Engine.");
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!results) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Requirement ID,Test Type,Title,Steps,Expected Result\n";

    results.forEach(req => {
      req.testcases.forEach(tc => {
        // Escape quotes and commas for CSV format
        const title = `"${tc.title.replace(/"/g, '""')}"`;
        const steps = `"${tc.steps.join(' | ').replace(/"/g, '""')}"`;
        const expected = `"${tc.expected_result.replace(/"/g, '""')}"`;
        
        csvContent += `${req.requirement_id},${tc.type},${title},${steps},${expected}\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "testforge_traceability_matrix.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-light min-vh-100 py-5">
      <Container>
        {/* Header Section */}
        <Row className="mb-4 text-center">
          <Col>
            <h1 className="fw-bold text-primary">TestForge<span className="text-dark"> Engine</span></h1>
            <p className="text-muted">Enterprise-Grade QA Automation & Traceability</p>
          </Col>
        </Row>

        <Row className="g-4">
          {/* Left Column: Input Area */}
          <Col lg={4}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Header className="bg-white border-0 pt-4 pb-0">
                <h5 className="fw-bold mb-0">1. Input Requirements</h5>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label className="text-muted small">Paste your Product Requirements Document (PRD) here:</Form.Label>
                  <Form.Control 
                    as="textarea" 
                    rows={12} 
                    placeholder="e.g., The system shall allow users to login using a valid email and an 8-character password..."
                    value={prdText}
                    onChange={(e) => setPrdText(e.target.value)}
                    style={{ resize: 'none' }}
                  />
                </Form.Group>
                <Button 
                  variant="primary" 
                  className="w-100 py-2 fw-bold" 
                  onClick={handleGenerate} 
                  disabled={loading || !prdText}
                >
                  {loading ? (
                    <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/> Orchestrating Models...</>
                  ) : "Generate Test Suite"}
                </Button>
                
                {error && <div className="text-danger mt-3 small fw-bold">{error}</div>}
              </Card.Body>
            </Card>
          </Col>

          {/* Right Column: Output & Dashboard */}
          <Col lg={8}>
            <Card className="shadow-sm border-0 h-100 bg-white">
              <Card.Header className="bg-white border-bottom-0 pt-4 pb-2 d-flex justify-content-between align-items-center">
                <h5 className="fw-bold mb-0">2. Traceability Matrix</h5>
                {provider && (
                  <Badge bg="success" className="px-3 py-2 rounded-pill">
                    Model Active: {provider}
                  </Badge>
                )}
              </Card.Header>
              <Card.Body className={results ? "" : "d-flex align-items-center justify-content-center"}>
                
                {!results && !loading && (
                  <div className="text-muted text-center">
                    <i className="bi bi-file-earmark-text display-4 mb-3 d-block opacity-25"></i>
                    <p>Awaiting PRD input to generate test cases.</p>
                  </div>
                )}

                {loading && (
                  <div className="text-center text-primary">
                    <Spinner animation="grow" />
                    <p className="mt-3 fw-bold">Analyzing specifications & cascading through LLMs...</p>
                  </div>
                )}

                {results && (
                  <>
                    <div className="d-flex justify-content-end mb-3">
                      <Button variant="outline-dark" size="sm" onClick={downloadCSV}>
                        Export CSV for Jira
                      </Button>
                    </div>
                    <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                      <Table hover className="align-middle">
                        <thead className="table-light sticky-top">
                          <tr>
                            <th>Req ID</th>
                            <th>Type</th>
                            <th>Test Title</th>
                            <th>Expected Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((req, reqIndex) => (
                            req.testcases.map((tc, tcIndex) => (
                              <tr key={`${reqIndex}-${tcIndex}`}>
                                <td><Badge bg="secondary">{req.requirement_id}</Badge></td>
                                <td>
                                  <Badge bg={
                                    tc.type === 'functional' ? 'primary' : 
                                    tc.type === 'negative' ? 'danger' : 'warning'
                                  }>
                                    {tc.type.toUpperCase()}
                                  </Badge>
                                </td>
                                <td className="fw-semibold">{tc.title}</td>
                                <td className="text-muted small">{tc.expected_result}</td>
                              </tr>
                            ))
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;