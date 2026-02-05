import React from 'react';
import { Check, X } from 'lucide-react';

const PasswordStrength = ({ password }) => {
  const requirements = [
    { text: 'At least 8 characters', test: password.length >= 8 },
    { text: 'Contains uppercase letter', test: /[A-Z]/.test(password) },
    { text: 'Contains lowercase letter', test: /[a-z]/.test(password) },
    { text: 'Contains number', test: /\d/.test(password) },
    { text: 'Contains special character', test: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
  ];

  const passedCount = requirements.filter(req => req.test).length;
  const strength = passedCount <= 2 ? 'weak' : passedCount <= 4 ? 'medium' : 'strong';
  
  const strengthColors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500', 
    strong: 'bg-green-500'
  };

  const strengthText = {
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong'
  };

  return (
    <div className="mt-3 space-y-2">
      {/* Strength Bar */}
      <div className="flex items-center space-x-2">
        <span className="text-xs font-medium text-gray-600">Password Strength:</span>
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${strengthColors[strength]}`}
            style={{ width: `${(passedCount / 5) * 100}%` }}
          ></div>
        </div>
        <span className={`text-xs font-semibold ${
          strength === 'weak' ? 'text-red-600' : 
          strength === 'medium' ? 'text-yellow-600' : 
          'text-green-600'
        }`}>
          {strengthText[strength]}
        </span>
      </div>

      {/* Requirements List */}
      <div className="grid grid-cols-1 gap-1">
        {requirements.map((req, index) => (
          <div key={index} className="flex items-center space-x-2">
            {req.test ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <X className="w-3 h-3 text-red-400" />
            )}
            <span className={`text-xs ${
              req.test ? 'text-green-600' : 'text-gray-500'
            }`}>
              {req.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrength;