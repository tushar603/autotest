import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col, Form, Button, Card, Spinner, Badge, Table, ListGroup } from 'react-bootstrap';
import mermaid from 'mermaid';

function App() {
  const [prdText, setPrdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [provider, setProvider] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [generatingFlow, setGeneratingFlow] = useState(false);
  const [flowchartText, setFlowchartText] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
    const saved = localStorage.getItem('testforge_history');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (flowchartText) {
      mermaid.contentLoaded();
    }
  }, [flowchartText]);

  const handleScore = async () => {
    if (!prdText.trim()) return;
    setScoring(true);
    setError(null);
    setScoreData(null);

    try {
      const response = await axios.post('https://autotest-9n29.onrender.com/api/score', {
        text: prdText
      });
      setScoreData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to analyze PRD Readiness.");
    } finally {
      setScoring(false);
    }
  };

  const handleGenerateFlow = async () => {
    if (!prdText.trim()) return;
    setGeneratingFlow(true);
    setError(null);
    setFlowchartText(null);

    try {
      const response = await axios.post('https://autotest-9n29.onrender.com/api/flow', {
        text: prdText
      });
      console.log("[TestForge] AI Flow Data:", response.data); 
      const data = response.data;
      const nodes = data.nodes || [];
      const edges = data.edges || [];

      if (nodes.length === 0) {
        setError("AI failed to extract flowchart nodes. Please try generating again.");
        setGeneratingFlow(false);
        return;
      }

      let safeMermaid = 'graph TD\n';
      
      nodes.forEach(node => {
        const cleanLabel = (node.label || "Step").replace(/[^a-zA-Z0-9 ]/g, '');
        safeMermaid += `${node.id}["${cleanLabel}"]\n`;
      });
      
      edges.forEach(edge => {
        const cleanEdgeLabel = edge.label ? `|${edge.label.replace(/[^a-zA-Z0-9 ]/g, '')}|` : '';
        safeMermaid += `${edge.from} -->${cleanEdgeLabel} ${edge.to}\n`;
      });

      setFlowchartText(safeMermaid);
    } catch (err) {
      console.error("[TestForge] Flow Error:", err);
      setError("Failed to parse system flow data.");
    } finally {
      setGeneratingFlow(false);
    }
  };

  const saveToHistory = (text, matrix) => {
    const newItem = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      snippet: text.substring(0, 40) + '...',
      fullPrd: text,
      matrixData: matrix
    };
    const updated = [newItem, ...history].slice(0, 5);
    setHistory(updated);
    localStorage.setItem('testforge_history', JSON.stringify(updated));
  };

  const loadHistoryItem = (item) => {
    setPrdText(item.fullPrd);
    setResults(item.matrixData);
    setScoreData(null);
    setFlowchartText(null);
    setError(null);
    setProvider("Local Cache");
  };

  const handleGenerate = async () => {
    if (!prdText.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setProvider(null);

    try {
      const response = await axios.post('https://autotest-9n29.onrender.com/api/generate', {
        text: prdText
      });
      setResults(response.data.data);
      setProvider(response.data.provider);
      saveToHistory(prdText, response.data.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to connect to TestForge Engine.");
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!results) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Requirement ID,Test Type,Title,Steps,Input Data,Expected Result\n";

    results.forEach(req => {
      req.testcases.forEach(tc => {
        const title = `"${tc.title.replace(/"/g, '""')}"`;
        const steps = `"${(tc.steps || []).join(' | ').replace(/"/g, '""')}"`;
        const testInput = `"${(tc.test_input || 'N/A').replace(/"/g, '""')}"`; 
        const expected = `"${tc.expected_result.replace(/"/g, '""')}"`;
        csvContent += `${req.requirement_id},${tc.type},${title},${steps},${testInput},${expected}\n`;
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

  const downloadPythonScript = async () => {
    if (!results) return;
    setGeneratingCode(true);
    setError(null);

    try {
      const response = await axios.post('https://autotest-9n29.onrender.com/api/generate-code', {
        test_data: results
      });
      
      const blob = new Blob([response.data.code], { type: 'text/x-python' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = 'testforge_automation.py';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to generate Selenium script.");
    } finally {
      setGeneratingCode(false);
    }
  };

  return (
    <div className="bg-light min-vh-100 py-5">
      <Container>
        <Row className="mb-4 text-center">
          <Col>
            <h1 className="fw-bold text-primary">TestForge<span className="text-dark"> Engine</span></h1>
            <p className="text-muted">Enterprise-Grade QA Automation & Traceability</p>
          </Col>
        </Row>

        <Row className="g-4">
          <Col lg={4}>
            <Card className="shadow-sm border-0 h-100 mb-4">
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
                  variant="outline-dark" 
                  className="w-100 py-2 fw-bold mb-2" 
                  onClick={handleScore} 
                  disabled={scoring || loading || generatingFlow || !prdText}
                >
                  {scoring ? (
                    <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/> Analyzing Ambiguity...</>
                  ) : "Analyze PRD Readiness (Shift-Left)"}
                </Button>

                <Button 
                  variant="outline-primary" 
                  className="w-100 py-2 fw-bold mb-2" 
                  onClick={handleGenerateFlow} 
                  disabled={scoring || loading || generatingFlow || !prdText}
                >
                  {generatingFlow ? (
                    <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/> Mapping Dependencies...</>
                  ) : "Map Visual Architecture"}
                </Button>

                <Button 
                  variant="primary" 
                  className="w-100 py-2 fw-bold" 
                  onClick={handleGenerate} 
                  disabled={loading || scoring || generatingFlow || !prdText}
                >
                  {loading ? (
                    <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/> Orchestrating Models...</>
                  ) : "Generate Test Suite"}
                </Button>
                
                {error && <div className="text-danger mt-3 small fw-bold">{error}</div>}
              </Card.Body>
            </Card>

            {history.length > 0 && (
              <Card className="shadow-sm border-0">
                <Card.Header className="bg-white border-0 pt-4 pb-0">
                  <h5 className="fw-bold mb-0">Recent Projects</h5>
                </Card.Header>
                <Card.Body>
                  <ListGroup variant="flush">
                    {history.map((item) => (
                      <ListGroup.Item action key={item.id} onClick={() => loadHistoryItem(item)} className="px-0 border-bottom">
                        <div className="d-flex w-100 justify-content-between">
                          <small className="fw-bold text-primary">Test Run</small>
                          <small className="text-muted">{item.date}</small>
                        </div>
                        <p className="mb-0 small text-truncate">{item.snippet}</p>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </Card.Body>
              </Card>
            )}
          </Col>

          <Col lg={8}>
            {scoreData && (
              <Card className="shadow-sm border-0 mb-4 border-start border-4 border-info">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="fw-bold mb-0 text-info">PRD Readiness Report</h5>
                    <h2>
                      <Badge bg={scoreData.readiness_score > 80 ? 'success' : scoreData.readiness_score > 50 ? 'warning' : 'danger'}>
                        {scoreData.readiness_score} / 100
                      </Badge>
                    </h2>
                  </div>
                  
                  {scoreData.vague_statements && scoreData.vague_statements.length > 0 ? (
                    <>
                      <h6 className="fw-bold text-danger mt-3"><i className="bi bi-exclamation-triangle-fill"></i> Ambiguity Detected:</h6>
                      <ListGroup variant="flush">
                        {scoreData.vague_statements.map((issue, idx) => (
                          <ListGroup.Item key={idx} className="bg-light mb-2 rounded border">
                            <strong>Statement:</strong> <code>"{issue.statement}"</code> <br/>
                            <span className="text-danger small fw-bold">Issue:</span> <span className="small text-muted">{issue.issue}</span>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </>
                  ) : (
                    <div className="alert alert-success py-2 mb-0">
                      <i className="bi bi-check-circle-fill me-2"></i> Excellent! No major ambiguities detected. Ready for test generation.
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}

            {flowchartText && (
              <Card className="shadow-sm border-0 mb-4 bg-white">
                <Card.Header className="bg-white border-bottom-0 pt-4 pb-2">
                  <h5 className="fw-bold mb-0">Visual Dependency Map</h5>
                </Card.Header>
                <Card.Body className="d-flex justify-content-center overflow-auto">
                  <div className="mermaid">{flowchartText}</div>
                </Card.Body>
              </Card>
            )}

            <Card className="shadow-sm border-0 bg-white" style={{ minHeight: '400px' }}>
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
                    <div className="d-flex justify-content-end gap-2 mb-3">
                      <Button variant="outline-success" size="sm" onClick={downloadPythonScript} disabled={generatingCode}>
                        {generatingCode ? (
                          <><Spinner as="span" animation="border" size="sm" className="me-1"/> Compiling Code...</>
                        ) : (
                          <>Download Selenium Script (.py)</>
                        )}
                      </Button>
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
                            <th>Input Data</th>
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
                                    tc.type.toLowerCase() === 'functional' ? 'primary' : 
                                    tc.type.toLowerCase() === 'negative' ? 'danger' : 'warning'
                                  }>
                                    {tc.type.toUpperCase()}
                                  </Badge>
                                </td>
                                <td className="fw-semibold">{tc.title}</td>
                                <td>
                                  <code className="text-dark bg-light px-2 py-1 rounded border">
                                    {tc.test_input || 'N/A'}
                                  </code>
                                </td>
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