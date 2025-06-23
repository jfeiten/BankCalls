import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, Edit3, Trash2, PlusCircle, Filter, Users, Columns, AlertTriangle, CheckCircle, XCircle, Clock, Phone, HelpCircle, TrendingUp, MessageSquare, UserCheck, UserX, UserMinus, Eye, CalendarDays, Smile, Frown, Meh } from 'lucide-react';

// --- Global App ID and User ID ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-crm-app';

const CUSTOMER_STATUSES = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  SUBSCRIBED: "Subscribed",
  NOT_SUBSCRIBED: "Not Subscribed",
  CONTACT_FAILED: "Contact Failed",
};

const PROBABLE_SUBSCRIBER_OPTIONS = ["Yes", "No", "Uncertain"];

const statusIcons = {
  [CUSTOMER_STATUSES.PENDING]: <Clock className="w-4 h-4 text-gray-500" />,
  [CUSTOMER_STATUSES.IN_PROGRESS]: <TrendingUp className="w-4 h-4 text-blue-500" />,
  [CUSTOMER_STATUSES.SUBSCRIBED]: <CheckCircle className="w-4 h-4 text-green-500" />,
  [CUSTOMER_STATUSES.NOT_SUBSCRIBED]: <XCircle className="w-4 h-4 text-red-500" />,
  [CUSTOMER_STATUSES.CONTACT_FAILED]: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
};

const probableSubscriberIcons = {
  "Yes": <Smile className="w-4 h-4 text-green-400" />,
  "No": <Frown className="w-4 h-4 text-red-400" />,
  "Uncertain": <Meh className="w-4 h-4 text-yellow-400" />,
};


const MARITAL_STATUSES = ["single", "married", "divorced", "unknown"];
const EDUCATION_LEVELS = ["illiterate", "basic.4y", "basic.6y", "basic.9y", "high.school", "professional.course", "university.degree", "unknown"];
const JOB_OPTIONS = ["admin.", "blue-collar", "entrepreneur", "housemaid", "management", "retired", "self-employed", "services", "student", "technician", "unemployed", "unknown"];
const YES_NO_UNKNOWN = ["yes", "no", "unknown"];
const CONTACT_TYPES = ["cellular", "telephone"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS_OF_WEEK = ["mon", "tue", "wed", "thu", "fri"]; 
const POUTCOME_OPTIONS = ["failure", "nonexistent", "success"];

const initialCustomerForm = {
  id: null, // Will be generated
  name: "",
  age: "",
  phoneNumber: "", 
  job: JOB_OPTIONS[0],
  maritalStatus: MARITAL_STATUSES[0],
  education: EDUCATION_LEVELS[0],
  defaultCredit: YES_NO_UNKNOWN[0],
  housingLoan: YES_NO_UNKNOWN[0],
  personalLoan: YES_NO_UNKNOWN[0],
  contactType: CONTACT_TYPES[0],
  lastContactDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
  lastContactMonth: "", 
  lastContactDayOfWeek: "", 
  campaignContacts: 1,
  pdays: null, 
  notPreviouslyContacted: true, 
  previousContacts: 0,
  poutcome: POUTCOME_OPTIONS[0],
  empVarRate: "",
  consPriceIdx: "",
  consConfIdx: "",
  euribor3m: "",
  nrEmployed: "",
  contactingStatus: CUSTOMER_STATUSES.PENDING,
  customerScore: null, 
  probableSubscriber: PROBABLE_SUBSCRIBER_OPTIONS[2], // Uncertain
  predictionExplanation: "",
  // Timestamps for local data, not from API
  createdAt: null,
  updatedAt: null,
  isDeleted: false,
};

// Helper function to get month and day from date string
const getDerivedDateParts = (dateString) => {
  if (!dateString) return { month: "", dayOfWeek: "" };
  try {
    const date = new Date(dateString + "T00:00:00"); 
    const month = MONTHS[date.getMonth()];
    const dayIndex = date.getDay(); 
    let dayOfWeek = "";
    if (dayIndex >= 1 && dayIndex <= 5) { 
      dayOfWeek = DAYS_OF_WEEK[dayIndex - 1];
    } else {
      dayOfWeek = "Weekend"; 
    }
    return { month, dayOfWeek };
  } catch (e) {
    console.error("Error parsing date:", e);
    return { month: "", dayOfWeek: "" };
  }
};

// Helper function to calculate pdays
const calculatePdays = (lastContactDateStr) => {
  if (!lastContactDateStr) {
    return null; 
  }
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const lastContactDate = new Date(lastContactDateStr + "T00:00:00");
    lastContactDate.setHours(0,0,0,0); 

    if (isNaN(lastContactDate.getTime())) {
        return null; 
    }
    
    const diffTime = today.getTime() - lastContactDate.getTime();
    if (diffTime < 0) return 0; 

    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch (e) {
    console.error("Error calculating pdays:", e);
    return null;
  }
};

// Add these constants at the top of the file, after the imports
const API_URL = import.meta.env.VITE_API_URL || 'http://api_url';
const API_USERNAME = import.meta.env.VITE_API_USERNAME || 'your_username';
const API_PASSWORD = import.meta.env.VITE_API_PASSWORD || 'your_secure_password';

// Helper function for making authenticated API requests
const makeAuthenticatedRequest = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Authorization': 'Basic ' + btoa(`${API_USERNAME}:${API_PASSWORD}`),
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    mode: 'cors'
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response;
};

// Main App Component
function App() {
  const [currentView, setCurrentView] = useState('list');
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProbable, setFilterProbable] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'customerScore', direction: 'descending' });
  
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [predictingCustomers, setPredictingCustomers] = useState(new Set());
  const [notification, setNotification] = useState(null);
  const [updatingShap, setUpdatingShap] = useState(false);
  const [customersWithoutShap, setCustomersWithoutShap] = useState(new Set());

  // Initialize auth
  useEffect(() => {
    const initAuth = async () => {
      try {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          setUserId('mockUserWithToken123');
      } else {
          setUserId(crypto.randomUUID());
      }
      setIsAuthReady(true);
      } catch (err) {
        console.error("Error initializing auth:", err);
        setUserId('anonymous');
        setIsAuthReady(true);
      }
    };
    initAuth();
  }, []);

  // Fetch data from API
  useEffect(() => {
    if (!isAuthReady) { 
      return;
    }
    
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const response = await makeAuthenticatedRequest('/list_customers/');
        const apiData = await response.json();
        
        const transformedCustomers = apiData.map((apiCust, index) => {
          let internalStatus = CUSTOMER_STATUSES.PENDING; 
          const apiStatusNormalized = apiCust.status ? apiCust.status.toLowerCase() : "";
          if (apiStatusNormalized === "not subscribed") internalStatus = CUSTOMER_STATUSES.NOT_SUBSCRIBED;
          else if (apiStatusNormalized === "pending") internalStatus = CUSTOMER_STATUSES.PENDING;
          else if (apiStatusNormalized === "in progress") internalStatus = CUSTOMER_STATUSES.IN_PROGRESS;
          else if (apiStatusNormalized === "subscribed") internalStatus = CUSTOMER_STATUSES.SUBSCRIBED;
          else if (apiStatusNormalized === "contact failed") internalStatus = CUSTOMER_STATUSES.CONTACT_FAILED;

          let probableSub = "Uncertain";
          if (apiCust.predicted_label === "Yes") probableSub = "Yes";
          else if (apiCust.predicted_label === "No") probableSub = "No";
          
          const { month, dayOfWeek } = getDerivedDateParts(""); 
          const pdaysValue = calculatePdays(""); 

          const customerId = parseInt(apiCust.customer_id || apiCust.id, 10);
          if (isNaN(customerId)) {
            console.error("Invalid customer ID received from API:", apiCust);
            return null;
          }

          return {
            ...initialCustomerForm, 
            id: customerId,
            name: apiCust.name || `Customer ${index + 1}`,
            phoneNumber: apiCust.telephone || "",
            contactingStatus: internalStatus,
            customerScore: apiCust.predicted_score !== null ? Number(apiCust.predicted_score) : null,
            probableSubscriber: probableSub,
            lastContactDate: "", 
            lastContactMonth: month,
            lastContactDayOfWeek: dayOfWeek,
            pdays: pdaysValue,
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString(), 
          };
        }).filter(customer => customer !== null);

        setCustomers(transformedCustomers);
        setError(null);
        
        // Check SHAP values for all customers
        checkShapValues(transformedCustomers);
      } catch (err) {
        console.error("Error fetching customers:", err);
        setError("Failed to load customers. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [isAuthReady]);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000); // Clear after 5 seconds
  };

  const checkShapValues = async (customers) => {
    const customersWithoutShapSet = new Set();
    
    for (const customer of customers) {
      try {
        const response = await makeAuthenticatedRequest(`/customers/${customer.id}/shap_values/`);
        const shapData = await response.json();
        
        // If no SHAP values or empty array, mark as without SHAP
        if (!shapData || !Array.isArray(shapData) || shapData.length === 0) {
          customersWithoutShapSet.add(customer.id);
        }
      } catch (err) {
        // If error fetching SHAP values, assume customer doesn't have them
        customersWithoutShapSet.add(customer.id);
      }
    }
    
    setCustomersWithoutShap(customersWithoutShapSet);
  };

  const handleSaveCustomer = async (customerData) => {
    try {
    const { month, dayOfWeek } = getDerivedDateParts(customerData.lastContactDate);
      const calculatedPdays = calculatePdays(customerData.lastContactDate);

    // Helper to convert yes/no/unknown to boolean/null
    const ynToBool = (val) => val === 'yes' ? true : val === 'no' ? false : null;
    const unknownToNull = (val) => val === 'unknown' ? null : val;

    const dataToSave = {
      name: customerData.name,
      telephone: customerData.phoneNumber,
      age: customerData.age === "" ? null : Number(customerData.age),
      job: customerData.job || "unknown",
      marital_status: customerData.maritalStatus,
      education: customerData.education,
      has_default_credit: customerData.defaultCredit, // 'yes' or 'no'
      has_housing_loan: customerData.housingLoan,     // 'yes' or 'no'
      has_personal_loan: customerData.personalLoan,   // 'yes' or 'no'
      contact_type: customerData.contactType,
      last_contact_date: customerData.lastContactDate || null,
      last_contact_month: month,
      last_contact_day_of_week: dayOfWeek,
      campaign: customerData.campaignContacts === "" ? null : Number(customerData.campaignContacts),
      last_contact_days: calculatedPdays === null ? null : calculatedPdays,
      previous_number_of_contacts: customerData.previousContacts === "" ? null : Number(customerData.previousContacts),
      previous_outcome: customerData.poutcome,
      emp_var_rate: customerData.empVarRate === "" ? null : Number(customerData.empVarRate),
      cons_price_idx: customerData.consPriceIdx === "" ? null : Number(customerData.consPriceIdx),
      cons_conf_idx: customerData.consConfIdx === "" ? null : Number(customerData.consConfIdx),
      euribor3m: customerData.euribor3m === "" ? null : Number(customerData.euribor3m),
      nr_employed: customerData.nrEmployed === "" ? null : Number(customerData.nrEmployed),
      status: "new",
      customer_partition: "unseen",
      excluded: false
    };

    console.log("Payload to /customers/", dataToSave);

    const response = await makeAuthenticatedRequest('/customers/', {
      method: 'POST',
      body: JSON.stringify(dataToSave),
    });

    const newCustomer = await response.json();
        
        // Close the form modal and show list view
      setEditingCustomer(null);
      setCurrentView('list');
      setError(null);
        showNotification('Customer saved successfully!', 'success');

        // Then fetch the updated list and start prediction
      const listResponse = await makeAuthenticatedRequest('/list_customers/');
        const apiData = await listResponse.json();
        
        const transformedCustomers = apiData.map((apiCust, index) => {
          let internalStatus = CUSTOMER_STATUSES.PENDING; 
          const apiStatusNormalized = apiCust.status ? apiCust.status.toLowerCase() : "";
          if (apiStatusNormalized === "not subscribed") internalStatus = CUSTOMER_STATUSES.NOT_SUBSCRIBED;
          else if (apiStatusNormalized === "pending") internalStatus = CUSTOMER_STATUSES.PENDING;
          else if (apiStatusNormalized === "in progress") internalStatus = CUSTOMER_STATUSES.IN_PROGRESS;
          else if (apiStatusNormalized === "subscribed") internalStatus = CUSTOMER_STATUSES.SUBSCRIBED;
          else if (apiStatusNormalized === "contact failed") internalStatus = CUSTOMER_STATUSES.CONTACT_FAILED;

          let probableSub = "Uncertain";
          if (apiCust.predicted_label === "Yes") probableSub = "Yes";
          else if (apiCust.predicted_label === "No") probableSub = "No";
          
          const { month, dayOfWeek } = getDerivedDateParts(""); 
          const pdaysValue = calculatePdays(""); 

          const customerId = parseInt(apiCust.customer_id || apiCust.id, 10);
          if (isNaN(customerId)) {
            console.error("Invalid customer ID received from API:", apiCust);
            return null;
          }

          return {
            ...initialCustomerForm, 
            id: customerId,
            name: apiCust.name || `Customer ${index + 1}`,
            phoneNumber: apiCust.telephone || "",
            contactingStatus: internalStatus,
            customerScore: apiCust.predicted_score !== null ? Number(apiCust.predicted_score) : null,
            probableSubscriber: probableSub,
            lastContactDate: "", 
            lastContactMonth: month,
            lastContactDayOfWeek: dayOfWeek,
            pdays: pdaysValue,
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString(), 
          };
        }).filter(customer => customer !== null);

        setCustomers(transformedCustomers);
        setIsLoading(false); // Set loading to false after fetching the list

        // Refresh SHAP status for the updated list
        checkShapValues(transformedCustomers);

        // Start prediction for the new customer
        const newCustomerId = newCustomer.id || newCustomer.customer_id;
        if (newCustomerId) {
          setPredictingCustomers(prev => new Set([...prev, newCustomerId]));
          showNotification('Starting prediction for new customer...', 'info');
          
          try {
          const updateResponse = await makeAuthenticatedRequest(`/update_customer_prediction/${newCustomerId}`, {
              method: 'POST',
            body: JSON.stringify({ customer_id: newCustomerId }),
            });
            
            if (!updateResponse.ok) {
              throw new Error(`Update prediction request failed with status ${updateResponse.status}`);
            }

            // Get the predictions
          const predictionsResponse = await makeAuthenticatedRequest(`/predictions/${newCustomerId}`);
            if (!predictionsResponse.ok) {
              throw new Error(`Get predictions request failed with status ${predictionsResponse.status}`);
            }
            
            const predictionData = await predictionsResponse.json();
            
            // Update the customer with new prediction data
            setCustomers(prevCustomers =>
              prevCustomers.map(cust =>
                cust.id === newCustomerId
                  ? {
                      ...cust,
                      customerScore: predictionData.predicted_score !== null ? Number(predictionData.predicted_score) : null,
                      probableSubscriber: predictionData.predicted_label === "Yes" ? "Yes" : predictionData.predicted_label === "No" ? "No" : "Uncertain",
                      predictionExplanation: predictionData.explanation || ""
                    }
                  : cust
              )
            );
            
            // Refresh SHAP status after prediction update
            const updatedCustomers = customers.map(cust =>
              cust.id === newCustomerId
                ? {
                    ...cust,
                    customerScore: predictionData.predicted_score !== null ? Number(predictionData.predicted_score) : null,
                    probableSubscriber: predictionData.predicted_label === "Yes" ? "Yes" : predictionData.predicted_label === "No" ? "No" : "Uncertain",
                    predictionExplanation: predictionData.explanation || ""
                  }
                : cust
            );
            checkShapValues(updatedCustomers);
            
            showNotification('Prediction completed successfully!', 'success');
          } catch (err) {
            console.error("Error updating prediction:", err);
            setError("Failed to update prediction. " + err.message);
            showNotification('Failed to update prediction', 'error');
          } finally {
            setPredictingCustomers(prev => {
              const newSet = new Set(prev);
              newSet.delete(newCustomerId);
              return newSet;
            });
        }
      }
    } catch (err) {
      console.error("Error saving customer:", err);
      setError("Failed to save customer. Please try again later.");
      showNotification('Failed to save customer', 'error');
      setIsLoading(false);
    }
  };

  const handleEditCustomer = async (customer) => {
    try {
      // Fetch complete customer details for editing
      const response = await makeAuthenticatedRequest(`/customers/${customer.id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch customer details: ${response.status}`);
      }
      const customerDetails = await response.json();
      
      // Combine with existing customer data and ensure all required fields are present
      const completeCustomerData = {
        ...initialCustomerForm,
        ...customer,
        ...customerDetails,
        id: customer.id, // Keep the original ID
        name: customerDetails.name || customer.name || "",
        phoneNumber: customerDetails.telephone || customer.phoneNumber || "",
        age: customerDetails.age || "",
        job: customerDetails.job || JOB_OPTIONS[0],
        maritalStatus: customerDetails.marital_status || MARITAL_STATUSES[0],
        education: customerDetails.education || EDUCATION_LEVELS[0],
        defaultCredit: customerDetails.has_default_credit || YES_NO_UNKNOWN[0],
        housingLoan: customerDetails.has_housing_loan || YES_NO_UNKNOWN[0],
        personalLoan: customerDetails.has_personal_loan || YES_NO_UNKNOWN[0],
        contactType: customerDetails.contact_type || CONTACT_TYPES[0],
        lastContactDate: customerDetails.last_contact_date || "",
        campaignContacts: customerDetails.campaign || "1",
        previousContacts: customerDetails.previous_number_of_contacts || "0",
        poutcome: customerDetails.previous_outcome || POUTCOME_OPTIONS[0],
        empVarRate: customerDetails.emp_var_rate || "",
        consPriceIdx: customerDetails.cons_price_idx || "",
        consConfIdx: customerDetails.cons_conf_idx || "",
        euribor3m: customerDetails.euribor3m || "",
        nrEmployed: customerDetails.nr_employed || "",
        contactingStatus: customer.contactingStatus || CUSTOMER_STATUSES.PENDING,
        customerScore: customer.customerScore,
        probableSubscriber: customer.probableSubscriber || PROBABLE_SUBSCRIBER_OPTIONS[2],
      };

      console.log("Complete customer data for editing:", completeCustomerData);
      setEditingCustomer(completeCustomerData);
      setCurrentView('form');
    } catch (err) {
      console.error("Error fetching customer details for editing:", err);
      setError("Failed to load customer details for editing. " + err.message);
      // Fallback to original customer data if API call fails
    setEditingCustomer(customer);
    setCurrentView('form');
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    if (window.confirm("Are you sure you want to delete this customer? This is a local delete.")) {
      setIsLoading(true);
      setTimeout(() => {
        setCustomers(prevCustomers => prevCustomers.filter(cust => cust.id !== customerId));
        setIsLoading(false);
        setError(null);
      }, 500);
    }
  };

  const handleUpdateStatus = async (customerId, newStatus) => {
    setIsLoading(true);
    setTimeout(() => {
      setCustomers(prevCustomers =>
        prevCustomers.map(cust =>
          cust.id === customerId ? { ...cust, contactingStatus: newStatus, updatedAt: new Date().toISOString() } : cust
        )
      );
      setIsLoading(false);
      setError(null);
    }, 300);
  };

  const handleOpenInsightsModal = async (customer) => {
    setIsLoading(true);
    try {
      if (!customer || typeof customer.id !== 'number') {
        throw new Error("Invalid customer ID");
      }

      // Update prediction
      await makeAuthenticatedRequest(`/update_customer_prediction/${customer.id}`, {
        method: 'POST',
        body: JSON.stringify({ customer_id: customer.id }),
      });

      // Get predictions
      const predictionsResponse = await makeAuthenticatedRequest(`/predictions/${customer.id}`);
      const predictionData = await predictionsResponse.json();

      // Determine probable subscriber status
      let probableSubscriber = "Uncertain";
      const predictedLabel = predictionData.predicted_label?.toLowerCase();
      if (predictedLabel === "yes") {
        probableSubscriber = "Yes";
      } else if (predictedLabel === "no") {
        probableSubscriber = "No";
      }

      // Update the customer with new prediction data
      const updatedCustomer = {
        ...customer,
        customerScore: predictionData.predicted_score,
        probableSubscriber: probableSubscriber,
        predictionExplanation: predictionData.explanation || ""
      };

      // Update the customer in the list
      setCustomers(prevCustomers =>
        prevCustomers.map(cust =>
          cust.id === customer.id ? updatedCustomer : cust
        )
      );

      // Refresh SHAP status after prediction update
      const updatedCustomers = customers.map(cust =>
        cust.id === customer.id ? updatedCustomer : cust
      );
      checkShapValues(updatedCustomers);

      setSelectedCustomer(completeCustomerData);
    setIsInsightsModalOpen(true);
    } catch (err) {
      console.error("Error in handleOpenInsightsModal:", err);
      setError("Failed to load prediction data. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseInsightsModal = () => {
    setIsInsightsModalOpen(false);
    setSelectedCustomer(null);
  };

  const filteredCustomers = useMemo(() => {
    return customers
      .filter(customer => !customer.isDeleted)
      .filter(customer => {
        const nameMatch = customer.name ? customer.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const scoreMatch = customer.customerScore !== null && customer.customerScore !== undefined ? customer.customerScore.toString().toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const phoneMatch = customer.phoneNumber ? customer.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) : false; 
        const matchesSearch = nameMatch || scoreMatch || phoneMatch;
        const matchesStatus = filterStatus ? customer.contactingStatus === filterStatus : true;
        const matchesProbable = filterProbable ? customer.probableSubscriber === filterProbable : true;
        return matchesSearch && matchesStatus && matchesProbable;
      })
      .sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (sortConfig.key === 'customerScore' || sortConfig.key === 'pdays') { 
            valA = valA === null || valA === undefined ? -Infinity : valA; 
            valB = valB === null || valB === undefined ? -Infinity : valB;
        } else {
            valA = valA === null || valA === undefined ? '' : valA;
            valB = valB === null || valB === undefined ? '' : valB;
        }

        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
  }, [customers, searchTerm, filterStatus, filterProbable, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleUpdateShapValues = async () => {
    setUpdatingShap(true);
    showNotification('Updating SHAP values...', 'info');
    
    try {
      await makeAuthenticatedRequest('/update_shap_values/', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: null
        }),
      });
      
      showNotification('SHAP values updated successfully!', 'success');
      
      // Refresh customer list and SHAP status after updating
      try {
        const response = await makeAuthenticatedRequest('/list_customers/');
        const apiData = await response.json();
        
        const transformedCustomers = apiData.map((apiCust, index) => {
          let internalStatus = CUSTOMER_STATUSES.PENDING; 
          const apiStatusNormalized = apiCust.status ? apiCust.status.toLowerCase() : "";
          if (apiStatusNormalized === "not subscribed") internalStatus = CUSTOMER_STATUSES.NOT_SUBSCRIBED;
          else if (apiStatusNormalized === "pending") internalStatus = CUSTOMER_STATUSES.PENDING;
          else if (apiStatusNormalized === "in progress") internalStatus = CUSTOMER_STATUSES.IN_PROGRESS;
          else if (apiStatusNormalized === "subscribed") internalStatus = CUSTOMER_STATUSES.SUBSCRIBED;
          else if (apiStatusNormalized === "contact failed") internalStatus = CUSTOMER_STATUSES.CONTACT_FAILED;

          let probableSub = "Uncertain";
          if (apiCust.predicted_label === "Yes") probableSub = "Yes";
          else if (apiCust.predicted_label === "No") probableSub = "No";
          
          const { month, dayOfWeek } = getDerivedDateParts(""); 
          const pdaysValue = calculatePdays(""); 

          const customerId = parseInt(apiCust.customer_id || apiCust.id, 10);
          if (isNaN(customerId)) {
            console.error("Invalid customer ID received from API:", apiCust);
            return null;
          }

          return {
            ...initialCustomerForm, 
            id: customerId,
            name: apiCust.name || `Customer ${index + 1}`,
            phoneNumber: apiCust.telephone || "",
            contactingStatus: internalStatus,
            customerScore: apiCust.predicted_score !== null ? Number(apiCust.predicted_score) : null,
            probableSubscriber: probableSub,
            lastContactDate: "", 
            lastContactMonth: month,
            lastContactDayOfWeek: dayOfWeek,
            pdays: pdaysValue,
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString(), 
          };
        }).filter(customer => customer !== null);

        setCustomers(transformedCustomers);
        checkShapValues(transformedCustomers);
      } catch (err) {
        console.error("Error refreshing customer list after SHAP update:", err);
      }
    } catch (err) {
      console.error("Error updating SHAP values:", err);
      setError("Failed to update SHAP values. Please try again later.");
      showNotification('Failed to update SHAP values', 'error');
    } finally {
      setUpdatingShap(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-xl font-semibold text-sky-300">Initializing Application...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-gray-100 font-inter p-4 md:p-6">
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-cyan-300">Banking Call Center CRM</h1>
          <div className="text-xs text-gray-400 mt-2 sm:mt-0">User ID: {userId || 'N/A'}</div>
        </div>
        <nav className="bg-slate-800/50 backdrop-blur-md shadow-lg rounded-lg p-3">
          <ul className="flex space-x-2 sm:space-x-4">
            <li>
              <button
                onClick={() => { setCurrentView('list'); setEditingCustomer(null); }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-in-out
                  ${currentView === 'list' ? 'bg-sky-500 text-white shadow-md' : 'text-gray-300 hover:bg-slate-700 hover:text-white'}`}
              >
                <Users className="inline w-4 h-4 mr-1" />
                List View
              </button>
            </li>
             <li>
                <button
                  onClick={() => { setEditingCustomer(null); setCurrentView('form'); }}
                  className="px-3 py-2 rounded-md text-sm font-medium bg-green-500 hover:bg-green-600 text-white shadow-md transition-all duration-200 ease-in-out flex items-center"
                >
                  <PlusCircle className="w-4 h-4 mr-1" /> New Customer
                </button>
              </li>
          </ul>
        </nav>
      </header>

      {error && (
        <div className="bg-red-700/80 border border-red-500 text-white px-4 py-3 rounded-lg relative mb-4 shadow-lg" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-0 ${
          notification.type === 'error' ? 'bg-red-700/80 border border-red-500' :
          notification.type === 'success' ? 'bg-green-700/80 border border-green-500' :
          'bg-sky-700/80 border border-sky-500'
        }`}>
          <div className="flex items-center">
            {notification.type === 'error' && <AlertTriangle className="w-5 h-5 mr-2" />}
            {notification.type === 'success' && <CheckCircle className="w-5 h-5 mr-2" />}
            {notification.type === 'info' && <Clock className="w-5 h-5 mr-2 animate-spin" />}
            <span className="text-white">{notification.message}</span>
          </div>
        </div>
      )}
      
      {/* Form-specific loading indicator for save operations */}
      {isLoading && currentView === 'form' && editingCustomer !== null && ( 
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-700 p-4 rounded-lg shadow-xl text-white">Saving customer data...</div>
        </div>
      )}

      <main>
        {isLoading && currentView !== 'form' ? (
          <div className="flex items-center justify-center h-[calc(100vh-200px)]">
            <div className="text-xl font-semibold text-sky-300">Loading Customer Data...</div>
          </div>
        ) : (
          <>
        {currentView === 'list' && (
          <CustomerList
            customers={filteredCustomers}
                isLoading={isLoading}
            onEdit={handleEditCustomer}
            onDelete={handleDeleteCustomer}
            onUpdateStatus={handleUpdateStatus}
            onSort={requestSort}
            sortConfig={sortConfig}
            setSearchTerm={setSearchTerm}
            setFilterStatus={setFilterStatus}
            setFilterProbable={setFilterProbable} 
                predictingCustomers={predictingCustomers}
                onUpdateShapValues={handleUpdateShapValues}
                updatingShap={updatingShap}
                customersWithoutShap={customersWithoutShap}
          />
        )}
        {currentView === 'form' && (
          <CustomerForm
            onSave={handleSaveCustomer}
            onCancel={() => { setEditingCustomer(null); setCurrentView('list'); setError(null); }}
            initialData={editingCustomer || initialCustomerForm}
          />
            )}
          </>
        )}
      </main>

       <footer className="text-center text-xs text-gray-500 mt-8 py-4 border-t border-slate-700">
        Banking CRM Application &copy; {new Date().getFullYear()} (Data from API)
      </footer>
    </div>
  );
}

// --- CustomerList Component ---
// Added isLoading to props
function CustomerList({ customers, isLoading, onEdit, onDelete, onUpdateStatus, onSort, sortConfig, setSearchTerm, setFilterStatus, setFilterProbable, predictingCustomers, onUpdateShapValues, updatingShap, customersWithoutShap }) {
  const [editingStatusCustomerId, setEditingStatusCustomerId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const customersPerPage = 10;

  const handleStatusClick = (customerId) => {
    setEditingStatusCustomerId(customerId === editingStatusCustomerId ? null : customerId);
  };

  const handleStatusChange = (customerId, newStatus) => {
    onUpdateStatus(customerId, newStatus);
    setEditingStatusCustomerId(null);
  };
  
  const getProbableSubscriberPillStyle = (probable) => {
    if (probable === "Yes") return "bg-green-600/70 text-green-100";
    if (probable === "No") return "bg-red-600/70 text-red-100";
    return "bg-yellow-600/70 text-yellow-100"; // Uncertain
  };

  const handleViewDetails = async (customer) => {
    try {
      // First, update the prediction for the customer
      await makeAuthenticatedRequest(`/update_customer_prediction/${customer.id}`, {
        method: 'POST',
        body: JSON.stringify({ customer_id: customer.id }),
      });

      // Then get the predictions
      const predictionsResponse = await makeAuthenticatedRequest(`/predictions/${customer.id}`);
      const predictionData = await predictionsResponse.json();

      // Get the customer details
      const response = await makeAuthenticatedRequest(`/customers/${customer.id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch customer details: ${response.status}`);
      }
      const customerDetails = await response.json();
      
      // Combine customer details with prediction data
      const completeCustomerData = {
        ...customerDetails,
        id: customer.id, // Keep the original ID
        customerScore: predictionData.predicted_score !== null ? Number(predictionData.predicted_score) : null,
        probableSubscriber: predictionData.predicted_label === "Yes" ? "Yes" : 
                           predictionData.predicted_label === "No" ? "No" : "Uncertain",
        predictionExplanation: predictionData.explanation || ""
      };

      console.log("Complete customer data:", completeCustomerData);
      setSelectedCustomer(completeCustomerData);
      setIsDetailsModalOpen(true);
      
      // Note: The customer list update will be handled by the parent component
      // since we don't have direct access to setCustomers here
    } catch (err) {
      console.error("Error fetching customer details:", err);
      setError("Failed to load customer details. " + err.message);
    }
  };

  // Calculate pagination
  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = customers.slice(indexOfFirstCustomer, indexOfLastCustomer);
  const totalPages = Math.ceil(customers.length / customersPerPage);

  console.log("CustomerList props:", { 
    totalCustomers: customers.length,
    currentPage,
    customersPerPage,
    currentCustomers: currentCustomers.length,
    isLoading
  }); // Debug log

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [customers]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-md shadow-xl rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <input
          type="text"
          placeholder="Search customers (name, score, phone)..." 
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-1/3 px-4 py-2 rounded-lg bg-slate-700 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-sky-500 focus:outline-none transition-shadow"
        />
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-5 h-5 text-sky-400" />
            <select
              onChange={(e) => setFilterStatus(e.target.value)}
              defaultValue=""
              className="px-4 py-2 rounded-lg bg-slate-700 text-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none"
            >
              <option value="">All Statuses</option>
              {Object.values(CUSTOMER_STATUSES).map(status => (
                  <option key={status} value={status}>{status}</option>
              ))}
            </select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto"> 
            <HelpCircle className="w-5 h-5 text-sky-400" title="Filter by Probable Subscriber"/> 
            <select
              onChange={(e) => setFilterProbable(e.target.value)}
              defaultValue=""
              className="px-4 py-2 rounded-lg bg-slate-700 text-gray-200 focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none"
            >
              <option value="">All Probabilities</option>
              {PROBABLE_SUBSCRIBER_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
              ))}
            </select>
        </div>
        {customersWithoutShap.size > 0 && (
          <button
            onClick={onUpdateShapValues}
            disabled={updatingShap}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 ${
              updatingShap 
                ? 'bg-slate-600 text-gray-400 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {updatingShap ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                Getting SHAP...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                Generate Explanation ({customersWithoutShap.size})
              </>
            )}
          </button>
        )}
      </div>
      {customers.length === 0 && !isLoading ? ( 
        <p className="text-center text-gray-400 py-8">No customers found. Try adjusting your filters or the API returned no data.</p>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm text-left text-gray-300">
          <thead className="text-xs text-sky-300 uppercase bg-slate-700/50">
            <tr>
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => onSort('name')}>
                Name
                {sortConfig.key === 'name' && (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼')}
                </th>
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => onSort('phoneNumber')}>
                Phone Number
                {sortConfig.key === 'phoneNumber' && (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼')}
              </th>
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors w-48" onClick={() => onSort('contactingStatus')}>
                Contacting Status
                {sortConfig.key === 'contactingStatus' && (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼')}
              </th>
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => onSort('customerScore')}>
                Customer Score
                {sortConfig.key === 'customerScore' && (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼')}
              </th>
              <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors w-32" onClick={() => onSort('probableSubscriber')}>
                Probable Subscriber
                {sortConfig.key === 'probableSubscriber' && (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼')}
              </th>
              <th scope="col" className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentCustomers.map(customer => {
              const isPredicting = predictingCustomers.has(customer.id);
              return (
              <tr key={customer.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{customer.name}</td>
                <td className="px-4 py-3">{customer.phoneNumber || 'N/A'}</td>
                <td className="px-4 py-3 relative w-48">
                  <button 
                    onClick={() => handleStatusClick(customer.id)}
                    className={`w-full text-left px-2 py-1 text-xs font-semibold rounded-full flex items-center gap-1 cursor-pointer
                    ${customer.contactingStatus === CUSTOMER_STATUSES.SUBSCRIBED ? 'bg-green-600 text-green-100 hover:bg-green-500' :
                      customer.contactingStatus === CUSTOMER_STATUSES.NOT_SUBSCRIBED ? 'bg-red-600 text-red-100 hover:bg-red-500' :
                      customer.contactingStatus === CUSTOMER_STATUSES.CONTACT_FAILED ? 'bg-yellow-600 text-yellow-100 hover:bg-yellow-500' :
                      customer.contactingStatus === CUSTOMER_STATUSES.IN_PROGRESS ? 'bg-blue-600 text-blue-100 hover:bg-blue-500' :
                      'bg-gray-600 text-gray-100 hover:bg-gray-500'}`}
                  >
                    {customer.contactingStatus && statusIcons[customer.contactingStatus] ? statusIcons[customer.contactingStatus] : null}
                    {customer.contactingStatus}
                    <ChevronDown className="w-3 h-3 ml-auto" />
                  </button>
                  {editingStatusCustomerId === customer.id && (
                    <div className="absolute z-10 mt-1 w-48 bg-slate-600 border border-slate-500 rounded-md shadow-lg py-1">
                      {Object.values(CUSTOMER_STATUSES).map(status => (
                        <a
                          key={status}
                          href="#"
                          onClick={(e) => { e.preventDefault(); handleStatusChange(customer.id, status); }}
                          className="block px-3 py-1.5 text-xs text-gray-200 hover:bg-sky-500 hover:text-white"
                        >
                          {status}
                        </a>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                    {isPredicting ? (
                      <span className="text-yellow-400 flex items-center gap-1">
                        <Clock className="w-4 h-4 animate-spin" />
                        Predicting...
                      </span>
                    ) : (
                      customer.customerScore !== null ? customer.customerScore : 'N/A'
                    )}
                  </td>
                  <td className="px-4 py-3 w-32">
                    {isPredicting ? (
                      <span className="text-yellow-400 flex items-center gap-1">
                        <Clock className="w-4 h-4 animate-spin" />
                        Predicting...
                      </span>
                    ) : (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${getProbableSubscriberPillStyle(customer.probableSubscriber)}`}>
                        {customer.probableSubscriber && probableSubscriberIcons[customer.probableSubscriber] ? probableSubscriberIcons[customer.probableSubscriber] : null}
                        {customer.probableSubscriber || 'N/A'}
                    </span>
                    )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleViewDetails(customer)}
                      className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded transition-colors"
                    >
                      View Details
                    </button>
                    {customersWithoutShap.has(customer.id) && (
                      <span className="text-xs bg-orange-600/70 text-orange-100 px-2 py-1 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        No Explanation
                      </span>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-700/50 border-t border-slate-600">
            <div className="flex items-center">
              <span className="text-sm text-gray-400">
                Showing {indexOfFirstCustomer + 1} to {Math.min(indexOfLastCustomer, customers.length)} of {customers.length} customers
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm font-medium text-gray-300 bg-slate-600 rounded-md hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm font-medium text-gray-300 bg-slate-600 rounded-md hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
      </div>
        )}
      </div>
      )}

      {isDetailsModalOpen && selectedCustomer && (
        <CustomerDetailsModal
          customer={selectedCustomer}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedCustomer(null);
          }}
        />
      )}
    </div>
  );
}

// --- CustomerForm Component ---
function CustomerForm({ onSave, onCancel, initialData }) {
  const [formData, setFormData] = useState(() => {
    const { month, dayOfWeek } = getDerivedDateParts(initialData.lastContactDate);
    const score = initialData.customerScore === null || initialData.customerScore === undefined ? "" : initialData.customerScore;
    const calculatedPdays = calculatePdays(initialData.lastContactDate); 
    return { 
        ...initialCustomerForm, 
        ...initialData, 
        customerScore: score, 
        probableSubscriber: initialData.probableSubscriber || PROBABLE_SUBSCRIBER_OPTIONS[2], 
        predictionExplanation: initialData.predictionExplanation || "", 
        lastContactMonth: month, 
        lastContactDayOfWeek: dayOfWeek,
        pdays: calculatedPdays !== null ? String(calculatedPdays) : "" 
    };
  });
  const [activeTab, setActiveTab] = useState('demographic');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const { month, dayOfWeek } = getDerivedDateParts(initialData.lastContactDate);
    const ageValue = initialData.age === null || initialData.age === undefined ? "" : String(initialData.age);
    const phoneValue = initialData.phoneNumber === null || initialData.phoneNumber === undefined ? "" : String(initialData.phoneNumber);
    const calculatedPdays = calculatePdays(initialData.lastContactDate);
    
    const numericFieldsToInitialize = ['campaignContacts', 'previousContacts', 'empVarRate', 'consPriceIdx', 'consConfIdx', 'euribor3m', 'nrEmployed'];
    const initializedNumericFields = {};
    numericFieldsToInitialize.forEach(field => {
        initializedNumericFields[field] = initialData[field] === null || initialData[field] === undefined ? "" : String(initialData[field]);
    });

    setFormData({ 
        ...initialCustomerForm, 
        ...initialData, 
        lastContactDate: initialData.lastContactDate || "",
        lastContactMonth: month, 
        lastContactDayOfWeek: dayOfWeek,
        pdays: calculatedPdays !== null ? String(calculatedPdays) : "", 
        age: ageValue,
        phoneNumber: phoneValue, 
        ...initializedNumericFields,
        maritalStatus: initialData.maritalStatus || MARITAL_STATUSES[0],
        education: initialData.education || EDUCATION_LEVELS[0],
        defaultCredit: initialData.defaultCredit || YES_NO_UNKNOWN[0],
        housingLoan: initialData.housingLoan || YES_NO_UNKNOWN[0],
        personalLoan: initialData.personalLoan || YES_NO_UNKNOWN[0],
        contactType: initialData.contactType || CONTACT_TYPES[0],
        poutcome: initialData.poutcome || POUTCOME_OPTIONS[0],
        contactingStatus: initialData.contactingStatus || CUSTOMER_STATUSES.PENDING,
        // Ensure all required fields have default values
        name: initialData.name || "",
        campaignContacts: initialData.campaignContacts || "1",
        empVarRate: initialData.empVarRate || "",
        consPriceIdx: initialData.consPriceIdx || "",
        consConfIdx: initialData.consConfIdx || "",
        euribor3m: initialData.euribor3m || "",
        nrEmployed: initialData.nrEmployed || "",
        previousContacts: initialData.previousContacts || "0",
     });
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let newFormData = { ...formData };

    if (name === "notPreviouslyContacted") {
      newFormData = { 
        ...newFormData, 
        notPreviouslyContacted: checked,
        pdays: checked ? null : calculatePdays(formData.lastContactDate)
      };
    } else {
      newFormData = { ...newFormData, [name]: type === 'checkbox' ? checked : value };
    }

    if (name === "lastContactDate") {
      const { month, dayOfWeek } = getDerivedDateParts(value);
      const calculatedPdays = formData.notPreviouslyContacted ? null : calculatePdays(value);
      newFormData = { 
          ...newFormData, 
          lastContactMonth: month, 
          lastContactDayOfWeek: dayOfWeek,
          pdays: calculatedPdays
        };
    }
    
    setFormData(newFormData);
    
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
    
    // Clear general error when user makes any change
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields validation
    if (!formData.name?.trim()) newErrors.name = 'Name is required';
    if (!formData.age?.toString().trim()) newErrors.age = 'Age is required';
    if (!formData.phoneNumber?.trim()) newErrors.phoneNumber = 'Phone number is required';
    if (!formData.lastContactDate?.trim()) newErrors.lastContactDate = 'Last contact date is required';
    if (!formData.campaignContacts?.toString().trim()) newErrors.campaignContacts = 'Campaign contacts is required';
    if (!formData.empVarRate?.toString().trim()) newErrors.empVarRate = 'Employment variation rate is required';
    if (!formData.consPriceIdx?.toString().trim()) newErrors.consPriceIdx = 'Consumer price index is required';
    if (!formData.consConfIdx?.toString().trim()) newErrors.consConfIdx = 'Consumer confidence index is required';
    if (!formData.euribor3m?.toString().trim()) newErrors.euribor3m = 'Euribor 3m rate is required';
    if (!formData.nrEmployed?.toString().trim()) newErrors.nrEmployed = 'Number of employees is required';

    // Numeric validation
    const numericFields = ['age', 'campaignContacts', 'previousContacts', 'empVarRate', 'consPriceIdx', 'consConfIdx', 'euribor3m', 'nrEmployed'];
    numericFields.forEach(field => {
      const value = formData[field];
      if (value && value.toString().trim() && isNaN(Number(value))) {
        newErrors[field] = 'Must be a number';
      }
    });

    // Range validation
    if (formData.empVarRate && formData.empVarRate.toString().trim() && (Number(formData.empVarRate) < -3.4 || Number(formData.empVarRate) > 1.4)) {
      newErrors.empVarRate = 'Must be between -3.4 and 1.4';
    }
    if (formData.consPriceIdx && formData.consPriceIdx.toString().trim() && (Number(formData.consPriceIdx) < 92.20 || Number(formData.consPriceIdx) > 94.77)) {
      newErrors.consPriceIdx = 'Must be between 92.20 and 94.77';
    }
    if (formData.consConfIdx && formData.consConfIdx.toString().trim() && (Number(formData.consConfIdx) < -50.8 || Number(formData.consConfIdx) > -26.9)) {
      newErrors.consConfIdx = 'Must be between -50.8 and -26.9';
    }
    if (formData.euribor3m && formData.euribor3m.toString().trim() && (Number(formData.euribor3m) < 0.634 || Number(formData.euribor3m) > 5.045)) {
      newErrors.euribor3m = 'Must be between 0.634 and 5.045';
    }
    if (formData.nrEmployed && formData.nrEmployed.toString().trim() && (Number(formData.nrEmployed) < 4963.6 || Number(formData.nrEmployed) > 5228.1)) {
      newErrors.nrEmployed = 'Must be between 4963.6 and 5228.1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
    const finalFormData = {
        ...formData,
        pdays: formData.notPreviouslyContacted ? null : calculatePdays(formData.lastContactDate)
    };
    onSave(finalFormData);
    } else {
      // Show a user-friendly message about missing fields
      const missingFields = [];
      if (!formData.name?.trim()) missingFields.push('Name');
      if (!formData.age?.toString().trim()) missingFields.push('Age');
      if (!formData.phoneNumber?.trim()) missingFields.push('Phone Number');
      if (!formData.lastContactDate?.trim()) missingFields.push("Today's Date");
      if (!formData.campaignContacts?.toString().trim()) missingFields.push('Campaign Contacts');
      if (!formData.empVarRate?.toString().trim()) missingFields.push('Employment Variation Rate');
      if (!formData.consPriceIdx?.toString().trim()) missingFields.push('Consumer Price Index');
      if (!formData.consConfIdx?.toString().trim()) missingFields.push('Consumer Confidence Index');
      if (!formData.euribor3m?.toString().trim()) missingFields.push('Euribor 3m Rate');
      if (!formData.nrEmployed?.toString().trim()) missingFields.push('Number of Employees');
      
      if (missingFields.length > 0) {
        const errorMessage = `Please fill in the following required fields: ${missingFields.join(', ')}`;
        setErrors(prev => ({ ...prev, general: errorMessage }));
      }
    }
  };

  const formTabs = {
    demographic: "Demographic",
    currentCampaign: "Current Campaign",
    previousCampaign: "Previous Campaign",
    credit: "Credit Info",
    context: "Social/Economic",
  };

  const renderFormFields = () => {
    switch (activeTab) {
      case 'demographic':
        return (
          <>
            <FormField label="Age" name="age" type="number" value={formData.age} onChange={handleChange} required error={errors.age} />
            <FormSelect label="Job" name="job" value={formData.job} onChange={handleChange} options={JOB_OPTIONS} required />
            <FormSelect label="Marital Status" name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} options={MARITAL_STATUSES} required />
            <FormSelect label="Education" name="education" value={formData.education} onChange={handleChange} options={EDUCATION_LEVELS} required />
          </>
        );
      case 'currentCampaign':
        return (
          <>
            <FormSelect label="Contact Type" name="contactType" value={formData.contactType} onChange={handleChange} options={CONTACT_TYPES} required />
            <FormField label="Today's Date" name="lastContactDate" type="date" value={formData.lastContactDate} onChange={handleChange} required error={errors.lastContactDate} />
            <FormField label="Month" name="lastContactMonth" value={formData.lastContactMonth} onChange={() => {}} readOnly={true} placeholder="Derived from date" />
            <FormField label="Day of Week" name="lastContactDayOfWeek" value={formData.lastContactDayOfWeek} onChange={() => {}} readOnly={true} placeholder="Derived from date" />
            <FormField label="Campaign Contacts" name="campaignContacts" type="number" value={formData.campaignContacts} onChange={handleChange} min="0" required error={errors.campaignContacts} placeholder="Number of contacts performed during this campaign" />
          </>
        );
      case 'previousCampaign':
        return (
          <>
            <div className="col-span-1 sm:col-span-2"> 
              <label className="block text-sm font-medium text-gray-300 mb-1">Previous Campaign Context</label>
              <div className="flex items-center space-x-2 mt-1">
                <label htmlFor="notPreviouslyContacted" className="flex items-center text-sm text-gray-300">
                  <input
                    type="checkbox"
                    id="notPreviouslyContacted"
                    name="notPreviouslyContacted"
                    checked={formData.notPreviouslyContacted}
                    onChange={handleChange}
                    className="h-4 w-4 text-sky-500 border-slate-500 rounded focus:ring-sky-400"
                  />
                  <span className="ml-2">Customer was not previously contacted</span>
                </label>
              </div>
            </div>
            <FormField 
                label="Days Since Last Contact (Previous Campaign)" 
                name="pdays" 
                type="text" 
                value={formData.pdays === null || formData.pdays === "" ? "N/A" : formData.pdays} 
                onChange={() => {}} 
                readOnly={true} 
                placeholder="Calculated" 
            />
            <FormField label="Previous Contacts" name="previousContacts" type="number" value={formData.previousContacts} onChange={handleChange} min="0" disabled={formData.notPreviouslyContacted} required={!formData.notPreviouslyContacted} placeholder="Number of contacts before this campaign" />
            <FormSelect label="Previous Campaign Outcome" name="poutcome" value={formData.poutcome} onChange={handleChange} options={POUTCOME_OPTIONS} disabled={formData.notPreviouslyContacted} required={!formData.notPreviouslyContacted} />
          </>
        );
      case 'credit':
        return (
          <>
            <FormSelect label="Credit in Default?" name="defaultCredit" value={formData.defaultCredit} onChange={handleChange} options={YES_NO_UNKNOWN} required />
            <FormSelect label="Housing Loan?" name="housingLoan" value={formData.housingLoan} onChange={handleChange} options={YES_NO_UNKNOWN} required />
            <FormSelect label="Personal Loan?" name="personalLoan" value={formData.personalLoan} onChange={handleChange} options={YES_NO_UNKNOWN} required />
          </>
        );
      case 'context':
        return (
          <>
            <FormField 
              label="Employment Variation Rate (quarterly)" 
              name="empVarRate" 
              type="number" 
              step="any" 
              value={formData.empVarRate} 
              onChange={handleChange}
              min="-3.4"
              max="1.4"
              required
              error={errors.empVarRate}
              placeholder="Range: -3.4 to 1.4"
            />
            <FormField 
              label="Consumer Price Index (monthly)" 
              name="consPriceIdx" 
              type="number" 
              step="any" 
              value={formData.consPriceIdx} 
              onChange={handleChange}
              min="92.20"
              max="94.77"
              required
              error={errors.consPriceIdx}
              placeholder="Range: 92.20 to 94.77"
            />
            <FormField 
              label="Consumer Confidence Index (monthly)" 
              name="consConfIdx" 
              type="number" 
              step="any" 
              value={formData.consConfIdx} 
              onChange={handleChange}
              min="-50.8"
              max="-26.9"
              required
              error={errors.consConfIdx}
              placeholder="Range: -50.8 to -26.9"
            />
            <FormField 
              label="Euribor 3m Rate (daily)" 
              name="euribor3m" 
              type="number" 
              step="any" 
              value={formData.euribor3m} 
              onChange={handleChange}
              min="0.634"
              max="5.045"
              required
              error={errors.euribor3m}
              placeholder="Range: 0.634 to 5.045"
            />
            <FormField 
              label="Number of Employees (quarterly)" 
              name="nrEmployed" 
              type="number" 
              step="any" 
              value={formData.nrEmployed} 
              onChange={handleChange}
              min="4963.6"
              max="5228.1"
              required
              error={errors.nrEmployed}
              placeholder="Range: 4963.6 to 5228.1"
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 shadow-2xl rounded-xl p-6 sm:p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-sky-300">
            {initialData.id ? 'Edit Customer' : 'Add New Customer'}
      </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Name and Phone Number at the top */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 bg-slate-700/50 rounded-lg">
          <FormField label="Name" name="name" value={formData.name} onChange={handleChange} required error={errors.name} />
          <FormField label="Phone Number" name="phoneNumber" type="tel" value={formData.phoneNumber} onChange={handleChange} required error={errors.phoneNumber} placeholder="e.g., 555-1234"/>
        </div>

        {/* General error message for missing fields */}
        {errors.general && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
              <span className="text-red-300 text-sm font-medium">{errors.general}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex space-x-2 mb-6">
            {Object.entries(formTabs).map(([key, label]) => (
            <button
              key={key}
                type="button"
              onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === key
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
            >
                {label}
            </button>
          ))}
      </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {renderFormFields()}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-600 hover:bg-slate-500 rounded-md shadow-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-md shadow-sm transition-colors"
            >
              {initialData.id ? 'Update Customer' : 'Add Customer'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

// --- FormField & FormSelect Helper Components ---
function FormField({ label, name, type = "text", value, onChange, required, min, max, step, placeholder, readOnly = false, disabled = false, error }) {
  const showRange = min !== undefined && max !== undefined;
  const rangeText = showRange ? ` (${min} to ${max})` : '';
  
  return (
    <div className={`${type === 'checkbox' ? 'col-span-1 sm:col-span-2 flex items-center' : 'col-span-1'}`}>
      <label htmlFor={name} className={`block text-sm font-medium text-gray-300 mb-1 ${type === 'checkbox' ? 'mr-2' : ''}`}>
        {label}
        {showRange && <span className="text-xs text-gray-400 ml-1">{rangeText}</span>}
        {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        name={name}
        id={name}
        value={value === null || value === undefined ? '' : value}
        onChange={onChange}
        required={required}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        readOnly={readOnly}
        disabled={disabled}
        className={`mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-gray-200 placeholder-gray-400 ${readOnly || disabled ? 'bg-slate-600 cursor-not-allowed opacity-70' : ''} ${type === 'checkbox' ? 'h-4 w-4 text-sky-500 border-slate-500 rounded focus:ring-sky-400' : ''}`}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function FormSelect({ label, name, value, onChange, options, required, readOnly = false, disabled = false }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">{label}{required && <span className="text-red-400">*</span>}</label>
      <select
        name={name}
        id={name}
        value={value === null || value === undefined ? '' : value} 
        onChange={onChange}
        required={required}
        disabled={readOnly || disabled}
        className={`mt-1 block w-full pl-3 pr-10 py-2 text-base bg-slate-700 border-slate-600 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md text-gray-200 appearance-none ${readOnly || disabled ? 'bg-slate-600 cursor-not-allowed opacity-70' : ''}`}
      >
        {options.map(option => (
          <option key={option} value={option}>
            {typeof option === 'string' ? option.charAt(0).toUpperCase() + option.slice(1) : option}
          </option>
        ))}
      </select>
    </div>
  );
}


// --- KanbanBoard Component ---
function KanbanBoard({ customers, onUpdateStatus, setError, checkShapValues }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const handleViewDetails = async (customer) => {
    try {
      // First, update the prediction for the customer
      await makeAuthenticatedRequest(`/update_customer_prediction/${customer.id}`, {
        method: 'POST',
        body: JSON.stringify({ customer_id: customer.id }),
      });

      // Then get the predictions
      const predictionsResponse = await makeAuthenticatedRequest(`/predictions/${customer.id}`);
      const predictionData = await predictionsResponse.json();

      // Get the customer details
      const response = await makeAuthenticatedRequest(`/customers/${customer.id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch customer details: ${response.status}`);
      }
      const customerDetails = await response.json();
      
      // Combine customer details with prediction data
      const completeCustomerData = {
        ...customerDetails,
        id: customer.id, // Keep the original ID
        customerScore: predictionData.predicted_score !== null ? Number(predictionData.predicted_score) : null,
        probableSubscriber: predictionData.predicted_label === "Yes" ? "Yes" : 
                           predictionData.predicted_label === "No" ? "No" : "Uncertain",
        predictionExplanation: predictionData.explanation || ""
      };

      console.log("Complete customer data:", completeCustomerData);
      setSelectedCustomer(completeCustomerData);
      setIsDetailsModalOpen(true);
      
      // Note: The customer list update will be handled by the parent component
      // since we don't have direct access to setCustomers here
    } catch (err) {
      console.error("Error fetching customer details:", err);
      setError("Failed to load customer details. " + err.message);
    }
  };

  const handleDragStart = (e, customer) => {
    setDraggedItem(customer);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', customer.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    if (draggedItem && draggedItem.contactingStatus !== newStatus) {
      onUpdateStatus(draggedItem.id, newStatus);
    }
    setDraggedItem(null);
  };
  
  const getColumnIcon = (status) => {
    const iconsMap = {
      [CUSTOMER_STATUSES.PENDING]: <Clock className="w-5 h-5 mr-2" />,
      [CUSTOMER_STATUSES.IN_PROGRESS]: <TrendingUp className="w-5 h-5 mr-2" />,
      [CUSTOMER_STATUSES.SUBSCRIBED]: <UserCheck className="w-5 h-5 mr-2" />,
      [CUSTOMER_STATUSES.NOT_SUBSCRIBED]: <UserX className="w-5 h-5 mr-2" />,
      [CUSTOMER_STATUSES.CONTACT_FAILED]: <UserMinus className="w-5 h-5 mr-2" />,
    };
    return iconsMap[status] || <HelpCircle className="w-5 h-5 mr-2" />;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-4">
      {Object.values(CUSTOMER_STATUSES).map(status => (
        <div
          key={status}
          className="bg-slate-800/50 backdrop-blur-md shadow-lg rounded-lg p-3 lg:w-1/5 min-w-[280px] flex-shrink-0"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, status)}
        >
          <h3 className="text-lg font-semibold text-sky-300 mb-3 pb-2 border-b border-slate-700 flex items-center">
            {getColumnIcon(status)}
            {status}
            <span className="ml-auto text-xs bg-slate-700 text-sky-300 px-2 py-0.5 rounded-full">
              {customers.filter(c => c.contactingStatus === status).length}
            </span>
          </h3>
          <div className="space-y-3 h-[calc(100vh-250px)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50">
            {customers
              .filter(customer => customer.contactingStatus === status)
              .map(customer => (
                <KanbanCard 
                  key={customer.id} 
                  customer={customer} 
                  onDragStart={handleDragStart} 
                  onViewDetails={handleViewDetails}
                />
              ))}
            {customers.filter(c => c.contactingStatus === status).length === 0 && (
                <p className="text-sm text-gray-500 text-center pt-4">No customers in this stage.</p>
            )}
          </div>
        </div>
      ))}

      {isDetailsModalOpen && selectedCustomer && (
        <CustomerDetailsModal
          customer={selectedCustomer}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedCustomer(null);
          }}
        />
      )}
    </div>
  );
}

// --- KanbanCard Component ---
function KanbanCard({ customer, onDragStart, onViewDetails }) {
  const getProbableSubscriberColor = (probable) => {
    if (probable === "Yes") return "text-green-400";
    if (probable === "No") return "text-red-400";
    return "text-yellow-400"; // Uncertain
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, customer)}
      className="bg-slate-700/70 p-3 rounded-md shadow-md cursor-grab active:cursor-grabbing hover:shadow-sky-500/20 transition-all duration-150 ease-in-out"
    >
      <div className="flex justify-between items-start mb-1">
        <h4 className="font-semibold text-gray-100 text-sm break-all">{customer.name}</h4>
        <div className="flex-shrink-0 space-x-1">
            <button onClick={() => onViewDetails(customer)} className="text-emerald-400 hover:text-emerald-300 transition-colors p-0.5 rounded-md hover:bg-slate-600" title="View Details"><Eye size={15} /></button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-1">Score: {customer.customerScore !== null ? customer.customerScore : 'N/A'}</p>
      <p className={`text-xs mb-2 font-medium ${getProbableSubscriberColor(customer.probableSubscriber)}`}>
        Probable Subscriber: {customer.probableSubscriber || 'N/A'}
      </p>
      {customer.predictionExplanation && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-300 text-[11px]">Prediction Details</summary>
          <p className="mt-1 bg-slate-600/50 p-1.5 rounded text-gray-300 text-[11px]">{customer.predictionExplanation}</p>
        </details>
      )}
    </div>
  );
}

// --- PredictiveInsightsModal Component ---
function PredictiveInsightsModal({ customer, isOpen, onClose }) {
  const [shapValues, setShapValues] = useState(null);
  const [isLoadingShap, setIsLoadingShap] = useState(false);
  const [shapError, setShapError] = useState(null);

  useEffect(() => {
    if (isOpen && customer) {
      const fetchShapValues = async () => {
        const customerId = customer.customer_id || customer.id;
        setIsLoadingShap(true);
        setShapError(null);
        try {
          const response = await makeAuthenticatedRequest(`/customers/${customerId}/shap_values/`);
          const data = await response.json();
          setShapValues(data);
        } catch (err) {
          console.error("Error fetching SHAP values:", err);
          setShapError(err.message);
        } finally {
          setIsLoadingShap(false);
        }
      };

      fetchShapValues();
    }
  }, [isOpen, customer]);

  if (!isOpen || !customer) return null;

  const getProbableSubscriberPill = (probable) => {
    let bgColor = "bg-yellow-500/30";
    let textColor = "text-yellow-300";
    if (probable === "Yes") {
      bgColor = "bg-green-500/30";
      textColor = "text-green-300";
    } else if (probable === "No") {
      bgColor = "bg-red-500/30";
      textColor = "text-red-300";
    }
    return <span className={`px-3 py-1 text-sm font-medium rounded-full ${bgColor} ${textColor}`}>{probable || 'N/A'}</span>;
  };

  const renderShapValues = () => {
    if (isLoadingShap) {
      return (
        <div className="flex items-center justify-center p-4">
          <Clock className="w-5 h-5 animate-spin text-sky-400 mr-2" />
          <span className="text-gray-400">Loading SHAP values...</span>
        </div>
      );
    }

    if (shapError) {
      return (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-md">
          <p className="text-red-300 text-sm">SHAP values not found. Try clicking the "Update SHAP Values" button in the main page.</p>
        </div>
      );
    }

    if (!shapValues || !Array.isArray(shapValues)) {
      return (
        <div className="p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-md">
          <p className="text-yellow-300 text-sm">No SHAP values available</p>
        </div>
      );
    }

    // Sort SHAP values by absolute value for better visualization
    const sortedShapValues = [...shapValues].sort((a, b) => 
      Math.abs(b.shap_value) - Math.abs(a.shap_value)
    );

    return (
      <div className="space-y-2">
        {sortedShapValues.map(({ feature_name, shap_value }) => (
          <div key={feature_name} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-md">
            <span className="text-gray-300 text-sm">{feature_name}</span>
            <span className={`text-sm font-medium ${
              shap_value > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {shap_value.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out" onClick={onClose}>
      <div className="bg-slate-800 shadow-2xl rounded-xl p-6 sm:p-8 w-full max-w-lg transform transition-all duration-300 ease-in-out scale-100" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-sky-300">Predictive Insights: {customer.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors">
            <XCircle size={24} />
          </button>
        </div>
        <div className="space-y-5 text-gray-300">
          <div>
            <label className="block text-sm font-medium text-gray-400">Customer Score</label>
            <p className="text-lg text-sky-200 p-2 bg-slate-700/50 rounded-md mt-1">
              {customer.customerScore !== null ? customer.customerScore.toFixed(4) : 'N/A'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400">Probable Subscriber</label>
            <div className="mt-1">{getProbableSubscriberPill(customer.probableSubscriber)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Feature Importance (SHAP Values)</label>
            <div className="max-h-[300px] overflow-y-auto pr-2">
              {renderShapValues()}
            </div>
          </div>
        </div>
         <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
            <button 
                onClick={onClose} 
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-600 hover:bg-slate-500 rounded-md shadow-sm transition-colors"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
}

// Add the new CustomerDetailsModal component
function CustomerDetailsModal({ customer, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('demographic');
  const [shapValues, setShapValues] = useState(null);
  const [isLoadingShap, setIsLoadingShap] = useState(false);
  const [shapError, setShapError] = useState(null);

  useEffect(() => {
    if (isOpen && customer) {
      const fetchShapValues = async () => {
        const customerId = customer.id;
        setIsLoadingShap(true);
        setShapError(null);
        try {
          const response = await makeAuthenticatedRequest(`/customers/${customerId}/shap_values/`);
          const data = await response.json();
          setShapValues(data);
        } catch (err) {
          console.error("Error fetching SHAP values:", err);
          setShapError(err.message);
        } finally {
          setIsLoadingShap(false);
        }
      };

      fetchShapValues();
    }
  }, [isOpen, customer]);

  if (!isOpen || !customer) return null;

  const getShapValue = (fieldName) => {
    if (!shapValues || !Array.isArray(shapValues)) return null;
    const shapEntry = shapValues.find(item => item.feature_name === fieldName);
    return shapEntry ? shapEntry.shap_value : null;
  };

  const formTabs = {
    demographic: "Demographic",
    currentCampaign: "Current Campaign",
    previousCampaign: "Previous Campaign",
    credit: "Credit Info",
    context: "Social/Economic",
  };

  const renderFormFields = () => {
    switch (activeTab) {
      case 'demographic':
        return (
          <>
            <DetailField label="Age" value={customer.age} shapValue={getShapValue('age')} />
            <DetailField label="Job" value={customer.job} shapValue={getShapValue('job')} />
            <DetailField label="Marital Status" value={customer.marital_status} shapValue={getShapValue('marital_status')} />
            <DetailField label="Education" value={customer.education} shapValue={getShapValue('education')} />
          </>
        );
      case 'currentCampaign':
        return (
          <>
            <DetailField label="Contact Type" value={customer.contact_type} shapValue={getShapValue('contact_type')} />
            <DetailField label="Today's Date" value={customer.last_contact_date} shapValue={getShapValue('last_contact_date')} />
            <DetailField label="Month" value={customer.last_contact_month} shapValue={getShapValue('last_contact_month')} />
            <DetailField label="Day of Week" value={customer.last_contact_day_of_week} shapValue={getShapValue('last_contact_day_of_week')} />
            <DetailField label="Campaign Contacts" value={customer.campaign} shapValue={getShapValue('campaign')} />
          </>
        );
      case 'previousCampaign':
        return (
          <>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-1">Previous Campaign Context</label>
              <div className="mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-gray-200">
                <span>Customer was {customer.previous_number_of_contacts === null || customer.previous_number_of_contacts === 0 ? 'not previously contacted' : 'previously contacted'}</span>
              </div>
            </div>
            <DetailField label="Days Since Last Contact (Previous Campaign)" value={customer.last_contact_days} shapValue={getShapValue('pdays')} />
            <DetailField label="Previous Contacts" value={customer.previous_number_of_contacts} shapValue={getShapValue('previous_number_of_contacts')} />
            <DetailField label="Previous Campaign Outcome" value={customer.previous_outcome} shapValue={getShapValue('previous_outcome')} />
          </>
        );
      case 'credit':
        return (
          <>
            <DetailField label="Credit in Default?" value={customer.has_default_credit} shapValue={getShapValue('has_default_credit')} />
            <DetailField label="Housing Loan?" value={customer.has_housing_loan} shapValue={getShapValue('has_housing_loan')} />
            <DetailField label="Personal Loan?" value={customer.has_personal_loan} shapValue={getShapValue('has_personal_loan')} />
          </>
        );
      case 'context':
        return (
          <>
            <DetailField label="Employment Variation Rate (quarterly)" value={customer.emp_var_rate} shapValue={getShapValue('emp_var_rate')} />
            <DetailField label="Consumer Price Index (monthly)" value={customer.cons_price_idx} shapValue={getShapValue('cons_price_idx')} />
            <DetailField label="Consumer Confidence Index (monthly)" value={customer.cons_conf_idx} shapValue={getShapValue('cons_conf_idx')} />
            <DetailField label="Euribor 3m Rate (daily)" value={customer.euribor3m} shapValue={getShapValue('euribor3m')} />
            <DetailField label="Number of Employees (quarterly)" value={customer.nr_employed} shapValue={getShapValue('nr_employed')} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 shadow-2xl rounded-xl p-6 sm:p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-semibold text-sky-300">Customer Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors">
            <XCircle size={24} />
          </button>
        </div>

        {/* Name and Phone Number at the top */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 bg-slate-700/50 rounded-lg">
          <DetailField label="Name" value={customer.name} shapValue={getShapValue('name')} />
          <DetailField label="Phone Number" value={customer.telephone} shapValue={getShapValue('telephone')} />
        </div>

        {/* Add prediction score display */}
        <div className="mb-6 p-4 bg-slate-700/50 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Prediction Score</label>
              <p className="text-lg text-sky-200 font-semibold">
                {customer.customerScore !== null ? customer.customerScore.toFixed(4) : 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Probable Subscriber</label>
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                customer.probableSubscriber === "Yes" ? "bg-green-500/30 text-green-300" :
                customer.probableSubscriber === "No" ? "bg-red-500/30 text-red-300" :
                "bg-yellow-500/30 text-yellow-300"
              }`}>
                {customer.probableSubscriber || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {isLoadingShap && (
          <div className="flex items-center justify-center p-4 mb-4 bg-slate-700/50 rounded-md">
            <Clock className="w-5 h-5 animate-spin text-sky-400 mr-2" />
            <span className="text-gray-400">Loading SHAP values...</span>
          </div>
        )}

        {shapError && (
          <div className="p-4 mb-4 bg-red-500/20 border border-red-500/50 rounded-md">
            <p className="text-red-300 text-sm">Error loading SHAP values: {shapError}</p>
          </div>
        )}

        <div className="mb-6 border-b border-slate-700">
          <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
            {Object.entries(formTabs).map(([key, title]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === key
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                  }`}
              >
                {title}
              </button>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {renderFormFields()}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-600 hover:bg-slate-500 rounded-md shadow-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value, shapValue }) {
  return (
    <div className="col-span-1">
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      <div className="mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-gray-200 flex justify-between items-center">
        <span>{value !== null && value !== undefined ? value : 'N/A'}</span>
        {shapValue !== null && (
          <span className={`text-sm font-medium ml-2 ${
            shapValue > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {shapValue.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}

export default App;
