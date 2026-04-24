import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Container, Row, Col, Form, Button, Card, Spinner, Badge, Table, ListGroup, Navbar, Nav, NavDropdown, Modal, InputGroup } from 'react-bootstrap';
import mermaid from 'mermaid';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('vit_faculty');
  const [loginPassword, setLoginPassword] = useState('password123');

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

  const analysisRef = useRef(null);
  const flowRef = useRef(null);
  const matrixRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: true, theme: 'neutral', fontFamily: 'Inter, sans-serif' });
    
    const savedUser = localStorage.getItem('testforge_user');
    if (savedUser) {
      setIsLoggedIn(true);
      setCurrentUser(savedUser);
      loadUserHistory(savedUser);
    }
  }, []);

  useEffect(() => {
    if (flowchartText) {
      mermaid.contentLoaded();
    }
  }, [flowchartText]);

  const loadUserHistory = (username) => {
    const historyKey = `testforge_history_${username}`;
    const saved = localStorage.getItem(historyKey);
    if (saved) {
      setHistory(JSON.parse(saved));
    } else {
      setHistory([]);
    }
  };

  const handleLogin = () => {
    if (!loginUsername.trim() || !loginPassword.trim()) return;
    localStorage.setItem('testforge_user', loginUsername);
    setIsLoggedIn(true);
    setCurrentUser(loginUsername);
    loadUserHistory(loginUsername);
    setShowLoginModal(false);
    setPrdText('');
    setResults(null);
    setScoreData(null);
    setFlowchartText(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('testforge_user');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setHistory([]);
    setPrdText('');
    setResults(null);
    setScoreData(null);
    setFlowchartText(null);
  };

  const saveToHistory = (text, matrix) => {
    if (!isLoggedIn || !currentUser) return;
    const newItem = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      snippet: text.substring(0, 45) + '...',
      fullPrd: text,
      matrixData: matrix
    };
    const updated = [newItem, ...history].slice(0, 5);
    setHistory(updated);
    localStorage.setItem(`testforge_history_${currentUser}`, JSON.stringify(updated));
  };

  const loadHistoryItem = (item) => {
    setPrdText(item.fullPrd);
    setResults(item.matrixData);
    setScoreData(null);
    setFlowchartText(null);
    setError(null);
    setProvider("Local Cache");
    setTimeout(() => {
        matrixRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleScore = async () => {
    if (!prdText.trim()) return;
    setScoring(true);
    setError(null);
    setScoreData(null);
    try {
      const response = await axios.post('https://autotest-9n29.onrender.com/api/score', { text: prdText });
      setScoreData(response.data);
      setTimeout(() => {
          analysisRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
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
      const response = await axios.post('https://autotest-9n29.onrender.com/api/flow', { text: prdText });
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
      setTimeout(() => {
          flowRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError("Failed to parse system flow data.");
    } finally {
      setGeneratingFlow(false);
    }
  };

  const handleGenerate = async () => {
    if (!prdText.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setProvider(null);
    try {
      const response = await axios.post('https://autotest-9n29.onrender.com/api/generate', { text: prdText });
      setResults(response.data.data);
      setProvider(response.data.provider);
      saveToHistory(prdText, response.data.data);
      setTimeout(() => {
          matrixRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
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
      const response = await axios.post('https://autotest-9n29.onrender.com/api/generate-code', { test_data: results });
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
    <div className="min-vh-100" style={{ backgroundColor: '#f4f6f9', fontFamily: 'Inter, sans-serif' }}>
      
      <Navbar bg="white" expand="lg" className="shadow-sm sticky-top py-3 px-4">
        <Container fluid>
          <Navbar.Brand href="#" className="fw-bolder fs-4" style={{ background: 'linear-gradient(90deg, #0d6efd, #6610f2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            <i className="bi bi-cpu-fill me-2"></i>TestForge Engine
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              {isLoggedIn && (
                <NavDropdown title="Recent Test Runs" id="basic-nav-dropdown" className="fw-medium text-dark">
                  {history.length > 0 ? (
                    history.map((item) => (
                      <NavDropdown.Item key={item.id} onClick={() => loadHistoryItem(item)} className="py-2 border-bottom border-light hover-bg-light">
                        <p className="mb-0 small fw-semibold text-dark text-truncate" style={{ maxWidth: '300px' }}>{item.snippet}</p>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>{item.date}</small>
                      </NavDropdown.Item>
                    ))
                  ) : (
                    <NavDropdown.Item className="text-muted small">No recent runs stored.</NavDropdown.Item>
                  )}
                </NavDropdown>
              )}
            </Nav>
            <Nav className="ms-auto align-items-center">
              {isLoggedIn ? (
                <>
                  <Navbar.Text className="me-3 text-secondary fw-medium">
                    Welcome, <span className="text-dark fw-bold">{currentUser}</span>
                  </Navbar.Text>
                  <Button variant="outline-danger" size="sm" className="rounded-pill px-3 fw-bold shadow-sm" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right me-2"></i>Logout
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="sm" className="rounded-pill px-3 fw-bold shadow-sm" onClick={() => setShowLoginModal(true)}>
                  <i className="bi bi-key me-2"></i>Login to TestForge
                </Button>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {!isLoggedIn && (
        <Container className="py-5 text-center mt-5">
          <Row className="justify-content-center">
            <Col lg={7}>
              <i className="bi bi-shield-lock-fill display-1 mb-4" style={{ color: '#adb5bd' }}></i>
              <h1 className="fw-bolder display-4 mb-3" style={{ color: '#343a40' }}>Enterprise QA Orchestration</h1>
              <p className="text-secondary fs-5 mb-5 fw-medium">Please login to access the Shift-Left ambiguity scanner, visual dependency mapping, and dynamic traceablity matrix generation pipeline.</p>
              <Button variant="primary" size="lg" className="px-5 py-3 shadow rounded-pill fw-bold" onClick={() => setShowLoginModal(true)}>
                Unlock Access <i className="bi bi-arrow-right ms-2"></i>
              </Button>
            </Col>
          </Row>
        </Container>
      )}

      {isLoggedIn && (
        <Container className="py-5 px-md-5">
          <Row className="g-5 justify-content-center">
            
            <Col lg={11}>
              <Card className="shadow-lg border-0 rounded-4 overflow-hidden mb-4">
                <Card.Header className="bg-white border-bottom pt-4 pb-3">
                  <h5 className="fw-bold mb-0 text-dark">
                    <i className="bi bi-file-earmark-text-fill me-2 text-primary"></i>1. Input Specifications (PRD)
                  </h5>
                </Card.Header>
                <Card.Body className="p-4">
                  <Form.Group className="mb-4">
                    <Form.Control 
                      as="textarea" 
                      rows={10} 
                      placeholder="Paste your full Product Requirements Document or specific user stories here..."
                      value={prdText}
                      onChange={(e) => setPrdText(e.target.value)}
                      style={{ resize: 'none', backgroundColor: '#fafbfc' }}
                      className="rounded-3 shadow-inner border-light fs-6 p-3"
                    />
                  </Form.Group>
                  <Row className="g-3">
                      <Col md={4}>
                          <Button variant="light" className="w-100 py-3 fw-bold text-dark border shadow-sm rounded-3 d-flex align-items-center justify-content-center" onClick={handleScore} disabled={scoring || loading || generatingFlow || !prdText}>
                            {scoring ? <Spinner as="span" animation="border" size="sm" className="me-2"/> : <i className="bi bi-shield-check me-2 text-info fs-5"></i>}
                            Analyze Readiness
                          </Button>
                      </Col>
                      <Col md={4}>
                          <Button variant="light" className="w-100 py-3 fw-bold text-dark border shadow-sm rounded-3 d-flex align-items-center justify-content-center" onClick={handleGenerateFlow} disabled={scoring || loading || generatingFlow || !prdText}>
                            {generatingFlow ? <Spinner as="span" animation="border" size="sm" className="me-2"/> : <i className="bi bi-diagram-3 me-2 text-primary fs-5"></i>}
                            Map Visual Flow
                          </Button>
                      </Col>
                      <Col md={4}>
                          <Button variant="primary" className="w-100 py-3 fw-bold shadow-sm rounded-3 d-flex align-items-center justify-content-center" onClick={handleGenerate} disabled={loading || scoring || generatingFlow || !prdText}>
                            {loading ? <Spinner as="span" animation="border" size="sm" className="me-2"/> : <i className="bi bi-magic me-2 fs-5"></i>}
                            Orchestrate Pipeline
                          </Button>
                      </Col>
                  </Row>
                  {error && <div className="text-danger mt-4 small fw-bold text-center bg-danger bg-opacity-10 py-3 rounded-3 border border-danger border-opacity-25"><i className="bi bi-exclamation-octagon-fill me-2"></i>{error}</div>}
                </Card.Body>
              </Card>
            </Col>

            {scoreData && (
              <Col lg={11} ref={analysisRef}>
                <Card className="shadow-lg border-0 rounded-4 overflow-hidden mb-4">
                  <div className={`bg-${scoreData.readiness_score > 80 ? 'success' : scoreData.readiness_score > 50 ? 'warning' : 'danger'}`} style={{ height: '4px' }}></div>
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h5 className="fw-bold mb-0 text-dark"><i className="bi bi-flag-fill me-2 text-secondary"></i>Shift-Left Analysis Summary</h5>
                      <Badge bg={scoreData.readiness_score > 80 ? 'success' : scoreData.readiness_score > 50 ? 'warning' : 'danger'} className="fs-5 px-3 py-2 rounded-pill shadow-sm">
                        PRD Score: {scoreData.readiness_score} / 100
                      </Badge>
                    </div>
                    {scoreData.vague_statements && scoreData.vague_statements.length > 0 ? (
                      <>
                        <h6 className="fw-bold text-danger mb-3"><i className="bi bi-exclamation-triangle-fill me-2"></i>Ambiguities Detected:</h6>
                        <ListGroup variant="flush" className="gap-3">
                          {scoreData.vague_statements.map((issue, idx) => (
                            <ListGroup.Item key={idx} className="bg-light border-0 rounded-3 p-3 shadow-sm">
                              <div className="mb-2"><strong>Statement Fragment:</strong> <code className="text-dark bg-white px-2 py-1 rounded border fs-7">{issue.statement}</code></div>
                              <div><span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 me-2 fw-medium">Risk Factor</span> <span className="small fw-medium text-secondary">{issue.issue}</span></div>
                            </ListGroup.Item>
                          ))}
                        </ListGroup>
                      </>
                    ) : (
                      <div className="alert alert-success border-0 shadow-sm rounded-3 py-3 mb-0 d-flex align-items-center">
                        <i className="bi bi-check-circle-fill fs-4 me-3"></i> 
                        <span className="fw-medium fs-6">Excellent specifications. No major ambiguities detected. Ready for pipeline generation.</span>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            )}

            {flowchartText && (
              <Col lg={11} ref={flowRef}>
                <Card className="shadow-lg border-0 rounded-4 overflow-hidden mb-4">
                  <Card.Header className="bg-white border-bottom pt-4 pb-3">
                    <h5 className="fw-bold mb-0 text-dark"><i className="bi bi-diagram-3-fill me-2 text-secondary"></i>Visual Architecture (Mermaid)</h5>
                  </Card.Header>
                  <Card.Body className="d-flex justify-content-center p-4 bg-light">
                    <div className="mermaid bg-white p-4 rounded-3 shadow-sm w-100 d-flex justify-content-center border">{flowchartText}</div>
                  </Card.Body>
                </Card>
              </Col>
            )}

            <Col lg={11} ref={matrixRef}>
              <Card className="shadow-lg border-0 rounded-4 overflow-hidden" style={{ minHeight: '500px' }}>
                <Card.Header className="bg-white border-bottom pt-4 pb-3 d-flex justify-content-between align-items-center">
                  <h5 className="fw-bold mb-0 text-dark"><i className="bi bi-table me-2 text-secondary"></i>2. AI-Generated Traceability Matrix</h5>
                  {provider && (
                    <Badge bg={provider === "Local Cache" ? "secondary" : "success"} className="px-3 py-2 rounded-pill fw-medium shadow-sm">
                      <i className="bi bi-database-fill-check me-2"></i>Active LLM: {provider}
                    </Badge>
                  )}
                </Card.Header>
                <Card.Body className={`p-0 ${results ? "" : "d-flex align-items-center justify-content-center bg-light"}`}>
                  
                  {!results && !loading && (
                    <div className="text-muted text-center py-5">
                      <i className="bi bi-cloud-slash display-1 mb-3 d-block opacity-25"></i>
                      <h5 className="fw-medium">Pipeline Standby</h5>
                      <p className="small">Awaiting input specs to orchestrate cascade.</p>
                    </div>
                  )}

                  {loading && (
                    <div className="text-center text-primary py-5">
                      <Spinner animation="border" style={{ width: '3.5rem', height: '3.5rem' }} className="mb-3" />
                      <h5 className="fw-bolder">Orchestrating Model Cascade...</h5>
                      <p className="text-muted small">Generating test inputs, functional paths, and edge cases.</p>
                    </div>
                  )}

                  {results && (
                    <div className="p-4">
                      <div className="d-flex justify-content-end gap-2 mb-4">
                        <Button variant="success" size="sm" className="fw-bold px-3 shadow-sm rounded-pill d-flex align-items-center" onClick={downloadPythonScript} disabled={generatingCode}>
                          {generatingCode ? <Spinner as="span" animation="border" size="sm" className="me-2"/> : <i className="bi bi-file-code-fill fs-6 me-2"></i>}
                          {generatingCode ? "Compiling..." : "Export Automation (.py)"}
                        </Button>
                        <Button variant="dark" size="sm" className="fw-bold px-3 shadow-sm rounded-pill d-flex align-items-center" onClick={downloadCSV}>
                          <i className="bi bi-file-earmark-spreadsheet-fill fs-6 me-2"></i> Export to Jira
                        </Button>
                      </div>
                      <div className="table-responsive rounded-3 border" style={{ maxHeight: '650px', overflowY: 'auto' }}>
                        <Table hover className="align-middle mb-0 table-borderless table-striped">
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
                                <tr key={`${reqIndex}-${tcIndex}`}>
                                  <td className="px-4"><Badge bg="light" text="dark" className="border shadow-sm fw-medium">{req.requirement_id}</Badge></td>
                                  <td className="px-3">
                                    <Badge bg={
                                      tc.type.toLowerCase() === 'functional' ? 'primary' : 
                                      tc.type.toLowerCase() === 'negative' ? 'danger' : 'warning'
                                    } className="rounded-pill shadow-sm px-2 py-1 fw-bold" style={{ fontSize: '0.7rem' }}>
                                      {tc.type.toUpperCase()}
                                    </Badge>
                                  </td>
                                  <td className="px-3 fw-semibold text-dark fs-7">{tc.title}</td>
                                  <td className="px-3">
                                    <code className="text-primary bg-primary bg-opacity-10 px-2 py-1 rounded border border-primary border-opacity-25" style={{ fontSize: '0.8rem' }}>
                                      {tc.test_input || 'N/A'}
                                    </code>
                                  </td>
                                  <td className="px-4 text-secondary small" style={{ fontSize: '0.8rem' }}>{tc.expected_result}</td>
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
      )}

      <Modal show={showLoginModal} onHide={() => setShowLoginModal(false)} centered backdrop="static">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bolder fs-4">TestForge Authentication</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="text-muted fw-bold small">Username</Form.Label>
              <InputGroup>
                <InputGroup.Text className="bg-white border-end-0"><i className="bi bi-person text-secondary"></i></InputGroup.Text>
                <Form.Control type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} className="rounded-end p-2 border-start-0" placeholder="vit_faculty" />
              </InputGroup>
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label className="text-muted fw-bold small">Password</Form.Label>
              <InputGroup>
                <InputGroup.Text className="bg-white border-end-0"><i className="bi bi-lock text-secondary"></i></InputGroup.Text>
                <Form.Control type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="rounded-end p-2 border-start-0" placeholder="••••••••" />
              </InputGroup>
            </Form.Group>
            <Button variant="primary" className="w-100 py-3 rounded-pill shadow fw-bold" onClick={handleLogin}>
              Access Enterprise Pipeline <i className="bi bi-box-arrow-in-right ms-2"></i>
            </Button>
          </Form>
          <div className="text-center mt-3 small text-muted">A valid faculty or student ID required. Mock credentials enabled for presentation.</div>
        </Modal.Body>
      </Modal>

      <footer className="text-center py-4 mt-5 text-secondary small border-top bg-white">
        VIT Pune - Final Year Project - B.Tech Computer Engineering - Awaiting Model Orchestra Cascade
      </footer>
    </div>
  );
}

export default App;