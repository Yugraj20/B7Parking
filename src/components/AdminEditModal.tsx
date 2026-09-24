import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust this path to your firebase config file

export const AdminEditModal = ({ item, onClose, collectionName = "parkingData" }) => {
  const [formData, setFormData] = useState({ 
    name: item?.name || '', 
    status: item?.status || '' 
  });
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!item?.id) return;
    
    setLoading(true);
    try {
      const docRef = doc(db, collectionName, item.id);
      await updateDoc(docRef, formData);
      alert("Data updated successfully!");
      onClose();
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("Failed to update data.");
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', background: '#fff', position: 'fixed', top: '20%', left: '50%', transform: 'translate(-50%, 0)', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h3 style={{ marginTop: 0 }}>Edit Parking Data</h3>
      <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label>
          Name:
          <input 
            type="text" 
            value={formData.name} 
            onChange={(e) => setFormData({...formData, name: e.target.value})} 
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </label>
        <label>
          Status:
          <input 
            type="text" 
            value={formData.status} 
            onChange={(e) => setFormData({...formData, status: e.target.value})} 
            style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
          />
        </label>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button type="submit" disabled={loading} style={{ padding: '8px 16px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminEditModal;
