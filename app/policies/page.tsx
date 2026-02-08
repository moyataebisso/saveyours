export default function PoliciesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="container-custom py-12">
        <h1 className="text-4xl font-bold mb-8">Policies</h1>
        
        <div className="card p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Cancellation & Refund Policy</h2>
          
          <p className="text-gray-600 mb-4">
            At SaveYours LLC, we value your commitment to learning lifesaving skills. 
            To ensure fairness and accommodate all participants, we have the following 
            cancellation and rescheduling policy:
          </p>

          <h3 className="font-semibold text-lg mb-3">Cancellations</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-600 mb-6">
            <li>A full refund will be issued if you notify us within 24 hours of registration.</li>
            <li>After 24 hours, course fees are non-refundable.</li>
          </ul>

          <h3 className="font-semibold text-lg mb-3">Rescheduling</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-600 mb-6">
            <li>If you are unable to attend your scheduled class, you may reschedule at no additional cost, 
                provided you email us at info@saveyours.net.</li>
            <li>Rescheduling requests must be submitted at least 24 hours before your scheduled class.</li>
            <li>Requests made less than 24 hours before the class, or failure to attend without notice 
                (no-show), will result in forfeiture of your course fee.</li>
          </ul>

          <h3 className="font-semibold text-lg mb-3">Attendance Policy</h3>
          <p className="text-gray-600 mb-6">
            Students must arrive ON-TIME for their scheduled in-person session. Failure to show up within 15 minutes of the scheduled in-person session will result in the forfeiture of your position in that class and your course fee.
          </p>

          <h3 className="font-semibold text-lg mb-3">Contact</h3>
          <p className="text-gray-600">
            For cancellations or rescheduling, please email{' '}
            <a href="mailto:info@saveyours.net" className="text-primary-600 hover:underline">info@saveyours.net</a>.
          </p>
        </div>

        <div className="card p-8">
          <h2 className="text-2xl font-bold mb-6">Terms & Conditions</h2>
          
          <p className="text-sm text-gray-500 mb-4">Last Updated: 09/06/2025</p>
          
          <p className="text-gray-600 mb-6">
            Welcome to SaveYours LLC. By registering for or participating in our CPR, AED, 
            and First Aid training courses, you agree to the following Terms & Conditions:
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3">1. Services Provided</h3>
              <p className="text-gray-600">
                SaveYours LLC provides CPR, AED, and First Aid training courses for individuals 
                and groups. Our courses are intended for educational purposes only. Completion 
                of training does not grant medical licensure or authorization to practice medicine.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">2. Registration & Payment</h3>
              <p className="text-gray-600">
                Full payment is required at the time of registration to secure your spot in a 
                course. You are responsible for ensuring that the contact information you provide 
                is accurate so we can communicate important updates.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">3. Training Materials</h3>
              <p className="text-gray-600">
                Any training manuals or materials provided are for personal use only and may not 
                be copied, distributed, or reproduced without prior written permission.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">4. Liability Disclaimer</h3>
              <p className="text-gray-600">
                SaveYours LLC makes every effort to provide accurate, effective, and safe instruction. 
                However, we are not responsible for how participants apply the training outside of class. 
                By attending a course, you acknowledge and agree that SaveYours LLC, its instructors, 
                and affiliates are not liable for any injury, loss, or damages that may occur during 
                or after training.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">5. Health & Safety</h3>
              <p className="text-gray-600">
                If you have any medical conditions or physical limitations, it is your responsibility 
                to consult with a physician before participating. You agree to inform the instructor 
                of any limitations that may affect your participation.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">6. Modifications to Terms</h3>
              <p className="text-gray-600">
                SaveYours LLC reserves the right to update or modify these Terms & Conditions at any 
                time. The most current version will always be posted on our website.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">7. Governing Law</h3>
              <p className="text-gray-600">
                These Terms & Conditions are governed by the laws of the State of Minnesota. Any 
                disputes shall be resolved in the courts of Minnesota.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}