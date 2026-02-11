import React, { useContext, useState } from 'react'
import {AuthContext} from '../contexts/AuthContext'

export default function History() {

    const{getHistoryOfUser} = useContext(AuthContext);
    const [meetings, setMeetings] = useState([])

  const routeTo = useNavigate();
   useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                setMeetings(history);
            } catch {
                // IMPLEMENT SNACKBAR
            }
        }

        fetchHistory();
    }, [])

  return (
    <div>History</div>

    
  )
}
