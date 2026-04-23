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
    mermaid.initialize({ startOnLoad: true, theme: 'neutral', fontFamily: 'Inter, sans-serif' });
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
      setError("Failed to parse system flow data.");
    } finally {
      setGeneratingFlow(false);
    }
  };

  const saveToHistory = (text, matrix) => {
    const newItem = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      snippet: text.substring(0, 45) + '...',
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
    <div className="min-vh-100 py-5" style={{ backgroundColor: '#f8f9fa' }}>
      <Container>
        <Row className="mb-5 text-center">
          <Col>
            <h1 className="fw-bolder display-5 mb-2" style={{ background: 'linear-gradient(90deg, #0d6efd, #6610f2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              TestForge Engine
            </h1>
            <p className="text-secondary fw-medium fs-5">Enterprise QA Automation & Traceability Pipeline</p>
          </Col>
        </Row>

        <Row className="g-4">
          <Col lg={4}>
            <Card className="shadow-lg border-0 rounded-4 mb-4 overflow-hidden">
              <Card.Header className="bg-white border-bottom-0 pt-4 pb-2">
                <h5 className="fw-bold mb-0 text-dark">1. Specifications</h5>
              </Card.Header>
              <Card.Body className="px-4 pb-4">
                <Form.Group className="mb-4">
                  <Form.Control 
                    as="textarea" 
                    rows={10} 
                    placeholder="Paste your Product Requirements Document (PRD) here..."
                    value={prdText}
                    onChange={(e) => setPrdText(e.target.value)}
                    style={{ resize: 'none', backgroundColor: '#fdfdfd' }}
                    className="rounded-3 shadow-sm border-light"
                  />
                </Form.Group>
                
                <div className="d-grid gap-3">
                  <Button 
                    variant="light" 
                    className="py-2 fw-bold text-dark border shadow-sm rounded-3 d-flex align-items-center justify-content-center" 
                    onClick={handleScore} 
                    disabled={scoring || loading || generatingFlow || !prdText}
                  >
                    {scoring ? <Spinner as="span" animation="border" size="sm" className="me-2"/> : <i className="bi bi-shield-check me-2 text-info fs-5"></i>}
                    Analyze PRD Readiness
                  </Button>

                  <Button 
                    variant="light" 
                    className="py-2 fw-bold text-dark border shadow-sm rounded-3 d-flex align-items-center justify-content-center" 
                    onClick={handleGenerateFlow} 
                    disabled={scoring || loading || generatingFlow || !prdText}
                  >
                    {generatingFlow ? <Spinner as="span" animation="border" size="sm" className="me-2"/> : <i className="bi bi-diagram-3 me-2 text-primary fs-5"></i>}
                    Map Visual Flow
                  </Button>

                  <Button 
                    variant="primary" 
                    className="py-3 fw-bold shadow rounded-3 d-flex align-items-center justify-content-center mt-2" 
                    onClick={handleGenerate} 
                    disabled={loading || scoring || generatingFlow || !prdText}
                  >
                    {loading ? <Spinner as="span" animation="border" size="sm" className="me-2"/> : <i className="bi bi-cpu me-2 fs-5"></i>}
                    Generate Test Suite
                  </Button>
                </div>
                
                {error && <div className="text-danger mt-3 small fw-bold text-center bg-danger bg-opacity-10 py-2 rounded-3">{error}</div>}
              </Card.Body>
            </Card>

            {history.length > 0 && (
              <Card className="shadow-lg border-0 rounded-4">
                <Card.Header className="bg-white border-bottom-0 pt-4 pb-2">
                  <h6 className="fw-bold mb-0 text-secondary text-uppercase tracking-wide">Recent Projects</h6>
                </Card.Header>
                <Card.Body className="p-0">
                  <ListGroup variant="flush" className="rounded-bottom-4 overflow-hidden">
                    {history.map((item) => (
                      <ListGroup.Item action key={item.id} onClick={() => loadHistoryItem(item)} className="p-3 border-bottom border-light hover-bg-light">
                        <div className="d-flex w-100 justify-content-between align-items-center mb-1">
                          <Badge bg="secondary" className="fw-normal rounded-pill">Cached</Badge>
                          <small className="text-muted" style={{ fontSize: '0.75rem' }}>{item.date}</small>
                        </div>
                        <p className="mb-0 small text-dark fw-medium">{item.snippet}</p>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </Card.Body>
              </Card>
            )}
          </Col>

          <Col lg={8}>
            {scoreData && (
              <Card className="shadow-lg border-0 mb-4 rounded-4 overflow-hidden">
                <div className={`bg-${scoreData.readiness_score > 80 ? 'success' : scoreData.readiness_score > 50 ? 'warning' : 'danger'}`} style={{ height: '4px' }}></div>
                <Card.Body className="p-4">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="fw-bold mb-0 text-dark">Shift-Left Readiness Report</h5>
                    <Badge bg={scoreData.readiness_score > 80 ? 'success' : scoreData.readiness_score > 50 ? 'warning' : 'danger'} className="fs-5 px-3 py-2 rounded-pill shadow-sm">
                      Score: {scoreData.readiness_score} / 100
                    </Badge>
                  </div>
                  
                  {scoreData.vague_statements && scoreData.vague_statements.length > 0 ? (
                    <>
                      <h6 className="fw-bold text-danger mb-3"><i className="bi bi-exclamation-triangle-fill me-2"></i>Ambiguities to Resolve:</h6>
                      <ListGroup variant="flush" className="gap-2">
                        {scoreData.vague_statements.map((issue, idx) => (
                          <ListGroup.Item key={idx} className="bg-light border-0 rounded-3 p-3 shadow-sm">
                            <div className="mb-1"><strong>Fragment:</strong> <code className="text-dark bg-white px-2 py-1 rounded border">{issue.statement}</code></div>
                            <div><span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 me-2">Issue</span> <span className="small fw-medium text-secondary">{issue.issue}</span></div>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </>
                  ) : (
                    <div className="alert alert-success border-0 shadow-sm rounded-3 py-3 mb-0 d-flex align-items-center">
                      <i className="bi bi-check-circle-fill fs-4 me-3"></i> 
                      <span className="fw-medium">Excellent specifications. No major ambiguities detected. Ready for pipeline generation.</span>
                    </div>
                  )}
                </Card.Body>
              </Card>
            )}

            {flowchartText && (
              <Card className="shadow-lg border-0 mb-4 rounded-4 overflow-hidden">
                <Card.Header className="bg-white border-bottom pt-4 pb-3">
                  <h5 className="fw-bold mb-0 text-dark">Visual Architecture Map</h5>
                </Card.Header>
                <Card.Body className="d-flex justify-content-center p-4 bg-light">
                  <div className="mermaid bg-white p-4 rounded-3 shadow-sm w-100 d-flex justify-content-center border">{flowchartText}</div>
                </Card.Body>
              </Card>
            )}

            <Card className="shadow-lg border-0 rounded-4 overflow-hidden" style={{ minHeight: '500px' }}>
              <Card.Header className="bg-white border-bottom pt-4 pb-3 d-flex justify-content-between align-items-center">
                <h5 className="fw-bold mb-0 text-dark">2. Traceability Matrix</h5>
                {provider && (
                  <Badge bg={provider === "Local Cache" ? "secondary" : "success"} className="px-3 py-2 rounded-pill fw-medium shadow-sm">
                    <i className="bi bi-database-check me-2"></i>{provider}
                  </Badge>
                )}
              </Card.Header>
              <Card.Body className={`p-0 ${results ? "" : "d-flex align-items-center justify-content-center bg-light"}`}>
                
                {!results && !loading && (
                  <div className="text-muted text-center py-5">
                    <i className="bi bi-box-seam display-1 mb-3 d-block opacity-25"></i>
                    <h5 className="fw-medium">Engine Standby</h5>
                    <p className="small">Awaiting PRD to orchestrate generation.</p>
                  </div>
                )}

                {loading && (
                  <div className="text-center text-primary py-5">
                    <Spinner animation="border" style={{ width: '3rem', height: '3rem' }} className="mb-3" />
                    <h5 className="fw-bold">Orchestrating AI Models...</h5>
                    <p className="text-muted small">Generating edge cases and functional paths.</p>
                  </div>
                )}

                {results && (
                  <div className="p-4">
                    <div className="d-flex justify-content-end gap-2 mb-4">
                      <Button variant="success" size="sm" className="fw-bold px-3 shadow-sm rounded-pill d-flex align-items-center" onClick={downloadPythonScript} disabled={generatingCode}>
                        {generatingCode ? <Spinner as="span" animation="border" size="sm" className="me-2"/> : <i className="bi bi-filetype-py fs-6 me-2"></i>}
                        {generatingCode ? "Compiling..." : "Export Selenium (.py)"}
                      </Button>
                      <Button variant="dark" size="sm" className="fw-bold px-3 shadow-sm rounded-pill d-flex align-items-center" onClick={downloadCSV}>
                        <i className="bi bi-file-earmark-spreadsheet fs-6 me-2"></i> Export to Jira
                      </Button>
                    </div>
                    <div className="table-responsive rounded-3 border" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                      <Table hover className="align-middle mb-0 table-borderless">
                        <thead className="table-light sticky-top shadow-sm">
                          <tr>
                            <th className="py-3 px-4 text-secondary fw-bold text-uppercase" style={{ fontSize: '0.8rem' }}>Req ID</th>
                            <th className="py-3 px-3 text-secondary fw-bold text-uppercase" style={{ fontSize: '0.8rem' }}>Type</th>
                            <th className="py-3 px-3 text-secondary fw-bold text-uppercase" style={{ fontSize: '0.8rem' }}>Test Title</th>
                            <th className="py-3 px-3 text-secondary fw-bold text-uppercase" style={{ fontSize: '0.8rem' }}>Input Data</th>
                            <th className="py-3 px-4 text-secondary fw-bold text-uppercase" style={{ fontSize: '0.8rem' }}>Expected Result</th>
                          </tr>
                        </thead>
                        <tbody className="border-top-0">
                          {results.map((req, reqIndex) => (
                            req.testcases.map((tc, tcIndex) => (
                              <tr key={`${reqIndex}-${tcIndex}`} className="border-bottom">
                                <td className="px-4"><Badge bg="light" text="dark" className="border shadow-sm">{req.requirement_id}</Badge></td>
                                <td className="px-3">
                                  <Badge bg={
                                    tc.type.toLowerCase() === 'functional' ? 'primary' : 
                                    tc.type.toLowerCase() === 'negative' ? 'danger' : 'warning'
                                  } className="rounded-pill shadow-sm px-2 py-1">
                                    {tc.type.toUpperCase()}
                                  </Badge>
                                </td>
                                <td className="px-3 fw-medium text-dark">{tc.title}</td>
                                <td className="px-3">
                                  <code className="text-primary bg-primary bg-opacity-10 px-2 py-1 rounded-3 border border-primary border-opacity-25" style={{ fontSize: '0.85rem' }}>
                                    {tc.test_input || 'N/A'}
                                  </code>
                                </td>
                                <td className="px-4 text-secondary small">{tc.expected_result}</td>
                              </tr>
                            ))
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </div>
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